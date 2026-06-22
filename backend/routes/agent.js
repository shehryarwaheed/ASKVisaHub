const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken, authorizeRoles('agent'));

async function getAgentId(pool, userId) {
  const r = await pool.request().input('uid', sql.Int, userId)
    .query('SELECT agent_id FROM Travel_Agent WHERE user_id = @uid');

  if (r.recordset[0]) return r.recordset[0].agent_id;

  // Self-Repair: Create missing profile
  const user = await pool.request().input('uid', sql.Int, userId).query('SELECT username, email FROM Users WHERE user_id = @uid');
  if (user.recordset[0]) {
    const { username, email } = user.recordset[0];
    const repair = await pool.request()
      .input('uid', sql.Int, userId)
      .input('fname', sql.VarChar, username)
      .input('email', sql.VarChar, email)
      .query(`INSERT INTO Travel_Agent (user_id, first_name, last_name, email) 
              VALUES (@uid, @fname, 'Officer', @email);
              SELECT SCOPE_IDENTITY() AS agent_id;`);
    const agentId = repair.recordset[0].agent_id;
    return agentId;
  }
  return null;
}

// GET /api/agent/work-requests - Applicants who selected this agent
router.get('/work-requests', async (req, res) => {
  try {
    const pool = await getPool();
    const agentId = await getAgentId(pool, req.user.userId);
    const result = await pool.request().input('agid', sql.Int, agentId)
      .query(`SELECT va.application_id as connection_id, va.application_id, a.first_name, a.last_name, a.cnic, a.passport_no, a.phone, a.email, a.date_of_birth, va.created_at as request_date, vt.visa_name
              FROM Visa_Application va
              INNER JOIN Applicant a ON va.applicant_id = a.applicant_id 
              JOIN Visa_Type vt ON va.visa_type_id = vt.visa_type_id
              JOIN Agent_Applicant_Connection aac ON va.application_id = aac.application_id
              WHERE va.agent_id = @agid 
                AND aac.is_approved = 0
                AND va.status_id NOT IN ('APPROVED', 'REJECTED', 'WITHDRAWN')
                AND va.application_id NOT IN (SELECT application_id FROM Applicants_History)
              ORDER BY va.created_at DESC`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/agent/approve-connection/:applicationId
router.put('/approve-connection/:applicationId', async (req, res) => {
  try {
    const pool = await getPool();
    const agentId = await getAgentId(pool, req.user.userId);
    const appId = req.params.applicationId;

    // 1. Update the application status to 'IN_REVIEW'
    await pool.request()
      .input('appid', sql.Int, appId)
      .input('agid', sql.Int, agentId)
      .query('UPDATE Visa_Application SET status_id=\'IN_REVIEW\', updated_at=GETDATE() WHERE application_id=@appid AND agent_id=@agid');

    // 2. Approve the connection in Agent_Applicant_Connection table
    await pool.request()
      .input('appid', sql.Int, appId)
      .input('agid', sql.Int, agentId)
      .query('UPDATE Agent_Applicant_Connection SET is_approved=1, approved_date=GETDATE() WHERE application_id=@appid AND agent_id=@agid');

    // 2. Notify applicant
    const appInfo = await pool.request().input('appid', sql.Int, appId)
      .query('SELECT a.user_id FROM Visa_Application va JOIN Applicant a ON va.applicant_id=a.applicant_id WHERE va.application_id=@appid');

    if (appInfo.recordset[0]) {
      await pool.request().input('rid', sql.Int, appInfo.recordset[0].user_id).input('sid', sql.Int, req.user.userId).input('ref', sql.Int, appId)
        .query(`INSERT INTO Notifications (receiver_id,sender_id,notification_type,title,message,reference_id) VALUES (@rid,@sid,'WORK_APPROVED','Agent Approved','Your agent has accepted to work on your application.',@ref)`);
    }

    res.json({ message: 'Request accepted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/agent/applications - Applications assigned to this agent
router.get('/applications', async (req, res) => {
  try {
    const pool = await getPool();
    const agentId = await getAgentId(pool, req.user.userId);
    const result = await pool.request().input('agid', sql.Int, agentId)
      .query(`SELECT va.*, vt.visa_name, vt.category AS visa_category, c.country_name, a.first_name AS app_first, a.last_name AS app_last, a.passport_no, a.cnic, a.email, a.date_of_birth, a.gender, a.phone, a.address,
              ISNULL((SELECT COUNT(*) FROM Payment p WHERE p.application_id = va.application_id AND p.payment_status = 'Paid'), 0) as is_paid
              FROM Visa_Application va 
              JOIN Visa_Type vt ON va.visa_type_id = vt.visa_type_id 
              JOIN Country c ON va.country_id = c.country_id 
              JOIN Applicant a ON va.applicant_id = a.applicant_id 
              JOIN Agent_Applicant_Connection aac ON va.application_id = aac.application_id
              WHERE va.agent_id = @agid 
                AND aac.is_approved = 1
                AND va.status_id NOT IN ('WITHDRAWN') 
                AND va.application_id NOT IN (SELECT application_id FROM Applicants_History)
              ORDER BY va.created_at DESC`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/agent/update-progress/:applicationId
router.put('/update-progress/:applicationId', async (req, res) => {
  try {
    const pool = await getPool();
    const { progress_percentage, status_id, remarks } = req.body;
    await pool.request().input('appid', sql.Int, req.params.applicationId)
      .input('prog', sql.Int, progress_percentage).input('status', sql.VarChar, status_id).input('rem', sql.VarChar, remarks || null)
      .query('UPDATE Visa_Application SET progress_percentage=@prog,status_id=@status,remarks=@rem,updated_at=GETDATE() WHERE application_id=@appid');
    res.json({ message: 'Progress updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});



// PUT /api/agent/finalize/:applicationId - Approve/Reject and move to history
router.put('/finalize/:applicationId', async (req, res) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const { final_status, remarks } = req.body;

    // 1. Get Application data
    const appResult = await transaction.request()
      .input('appid', sql.Int, req.params.applicationId)
      .query('SELECT * FROM Visa_Application WHERE application_id = @appid');

    if (appResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Application not found' });
    }
    const a = appResult.recordset[0];

    // 2. Update Status in main table
    await transaction.request()
      .input('appid', sql.Int, a.application_id)
      .input('status', sql.VarChar, final_status)
      .input('rem', sql.VarChar, remarks)
      .query('UPDATE Visa_Application SET status_id=@status, remarks=@rem, progress_percentage=100, updated_at=GETDATE() WHERE application_id=@appid');

    // 3. Get Payment info
    const payResult = await transaction.request()
      .input('appid', sql.Int, a.application_id)
      .query("SELECT TOP 1 amount FROM Payment WHERE application_id=@appid AND payment_status='Paid'");

    const payment = payResult.recordset[0];

    // 4. Archive to History
    await transaction.request()
      .input('appid', sql.Int, a.application_id)
      .input('aid', sql.Int, a.applicant_id)
      .input('agid', sql.Int, a.agent_id)
      .input('vtid', sql.Int, a.visa_type_id)
      .input('cid', sql.Int, a.country_id)
      .input('adate', sql.DateTime2, a.application_date)
      .input('tdate', sql.Date, a.intended_travel_date)
      .input('fs', sql.VarChar, final_status)
      .input('rem', sql.VarChar, remarks)
      .input('pamt', sql.Decimal(10, 2), payment?.amount || null)
      .input('pmeth', sql.VarChar, 'Card')
      .query(`INSERT INTO Applicants_History (
                application_id, applicant_id, agent_id, visa_type_id, country_id, 
                application_date, intended_travel_date, final_status, remarks, 
                payment_amount, payment_method, decision_date
              ) VALUES (
                @appid, @aid, @agid, @vtid, @cid, 
                @adate, @tdate, @fs, @rem, 
                @pamt, @pmeth, GETDATE()
              )`);

    // 5. Notify Applicant
    const userResult = await transaction.request()
      .input('aid', sql.Int, a.applicant_id)
      .query('SELECT user_id FROM Applicant WHERE applicant_id=@aid');

    if (userResult.recordset[0]) {
      await transaction.request()
        .input('rid', sql.Int, userResult.recordset[0].user_id)
        .input('sid', sql.Int, req.user.userId)
        .input('ref', sql.Int, a.application_id)
        .input('msg', sql.VarChar, `Your visa application has been ${final_status}.`)
        .query(`INSERT INTO Notifications (receiver_id, sender_id, notification_type, title, message, reference_id) 
                VALUES (@rid, @sid, 'APPLICATION_RESULT', 'Application Result', @msg, @ref)`);
    }

    // 6. Clean up connections
    await transaction.request()
      .input('appid', sql.Int, a.application_id)
      .query('DELETE FROM Agent_Applicant_Connection WHERE application_id=@appid');

    await transaction.commit();
    res.json({ message: 'Application finalized and archived successfully' });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error('Finalization Error:', err);
    res.status(500).json({ error: 'Failed to finalize application', details: err.message });
  }
});

// GET /api/agent/history
router.get('/history', async (req, res) => {
  try {
    const pool = await getPool();
    const agentId = await getAgentId(pool, req.user.userId);
    const result = await pool.request().input('agid', sql.Int, agentId)
      .query(`SELECT ah.*,vt.visa_name,c.country_name,a.first_name,a.last_name FROM Applicants_History ah JOIN Visa_Type vt ON ah.visa_type_id=vt.visa_type_id JOIN Country c ON ah.country_id=c.country_id JOIN Applicant a ON ah.applicant_id=a.applicant_id WHERE ah.agent_id=@agid ORDER BY ah.recorded_at DESC`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/agent/stats
router.get('/stats', async (req, res) => {
  try {
    const pool = await getPool();
    const agentId = await getAgentId(pool, req.user.userId);
    const r = await pool.request().input('agid', sql.Int, agentId).query(`
      SELECT (SELECT COUNT(*) FROM Visa_Application va JOIN Agent_Applicant_Connection aac ON va.application_id=aac.application_id WHERE va.agent_id=@agid AND aac.is_approved=1 AND va.status_id NOT IN ('APPROVED','REJECTED','WITHDRAWN')) AS active_count,
             (SELECT COUNT(*) FROM Applicants_History WHERE agent_id=@agid AND final_status='APPROVED') AS approved_count,
             (SELECT COUNT(*) FROM Applicants_History WHERE agent_id=@agid AND final_status='REJECTED') AS rejected_count,
             (SELECT COUNT(*) FROM Applicants_History WHERE agent_id=@agid) AS total_history`);
    res.json(r.recordset[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/agent/profile
router.get('/profile', async (req, res) => {
  try {
    const pool = await getPool();
    const agentId = await getAgentId(pool, req.user.userId);
    const r = await pool.request().input('agid', sql.Int, agentId)
      .query(`SELECT ta.*,ap.rating,ap.total_ratings,ap.hourly_fee,ap.experience_years,ap.available_hours,ap.bio FROM Travel_Agent ta LEFT JOIN Agent_Profile ap ON ta.agent_id=ap.agent_id WHERE ta.agent_id=@agid`);
    res.json(r.recordset[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/agent/profile
router.put('/profile', async (req, res) => {
  try {
    const pool = await getPool();
    const agentId = await getAgentId(pool, req.user.userId);
    const { hourly_fee, experience_years, available_hours, bio } = req.body;
    await pool.request()
      .input('agid', sql.Int, agentId)
      .input('hf', sql.Decimal(10, 2), hourly_fee)
      .input('ey', sql.Int, experience_years)
      .input('ah', sql.VarChar, available_hours)
      .input('b', sql.VarChar, bio)
      .query('UPDATE Agent_Profile SET hourly_fee=@hf,experience_years=@ey,available_hours=@ah,bio=@b WHERE agent_id=@agid');
    res.json({ message: 'Profile updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/agent/application/:id
router.delete('/application/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const appId = parseInt(req.params.id);
    const agentId = await getAgentId(pool, req.user.userId);

    // Security Check: Ensure this application is assigned to the current agent
    const ownershipCheck = await pool.request()
      .input('appid', sql.Int, appId)
      .input('agid', sql.Int, agentId)
      .query('SELECT 1 FROM Visa_Application WHERE application_id = @appid AND agent_id = @agid');

    if (ownershipCheck.recordset.length === 0) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete applications assigned to you.' });
    }

    // 2. Security Check: Block deletion if already paid
    const paymentCheck = await pool.request()
      .input('appid', sql.Int, appId)
      .query("SELECT 1 FROM Payment WHERE application_id = @appid AND payment_status = 'Paid'");

    if (paymentCheck.recordset.length > 0) {
      return res.status(403).json({ error: 'Security Violation: Cannot delete application with a verified payment.' });
    }

    // Use stored procedure for atomic, synchronized deletion
    await pool.request()
      .input('ApplicationID', sql.Int, appId)
      .execute('sp_DeleteApplication');

    res.json({ message: 'Application removed successfully from all dashboards' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/blacklist-request
router.post('/blacklist-request', async (req, res) => {
  try {
    const pool = await getPool();
    const { applicant_name, applicant_id, reason } = req.body;
    console.log(`🛡️ Blacklist request received for: ${applicant_name} (ID: ${applicant_id}). Reason: ${reason}`);

    // 1. Notify all admins
    const admins = await pool.request().query('SELECT user_id FROM Users WHERE role=\'admin\'');
    console.log(`👥 Found ${admins.recordset.length} admins to notify`);

    const msg = JSON.stringify({ applicant: applicant_name, reason: reason });

    for (const adm of admins.recordset) {
      await pool.request()
        .input('rid', sql.Int, adm.user_id)
        .input('sid', sql.Int, req.user.userId)
        .input('type', sql.VarChar, 'BLOCK_REQUEST')
        .input('title', sql.VarChar, 'Blacklist Request')
        .input('msg', sql.VarChar, msg)
        .query(`INSERT INTO Notifications (receiver_id, sender_id, notification_type, title, message) 
                VALUES (@rid, @sid, @type, @title, @msg)`);
    }

    console.log('✅ Blacklist request processed successfully');
    res.json({ message: 'Blacklist request sent to admin' });
  } catch (err) {
    console.error('❌ Blacklist request error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
