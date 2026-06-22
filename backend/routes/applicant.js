const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken, authorizeRoles('applicant'));

async function getApplicantId(pool, userId) {
  const r = await pool.request().input('uid', sql.Int, userId)
    .query('SELECT applicant_id FROM Applicant WHERE user_id = @uid');

  if (r.recordset[0]) return r.recordset[0].applicant_id;

  // Self-Repair: Create missing profile if it doesn't exist
  const user = await pool.request().input('uid', sql.Int, userId).query('SELECT username, email FROM Users WHERE user_id = @uid');
  if (user.recordset[0]) {
    const { username, email } = user.recordset[0];
    const repair = await pool.request()
      .input('uid', sql.Int, userId)
      .input('fname', sql.VarChar, username)
      .input('email', sql.VarChar, email)
      .query(`INSERT INTO Applicant (user_id, first_name, last_name, email, cnic, passport_no, date_of_birth, gender) 
              OUTPUT INSERTED.applicant_id
              VALUES (@uid, @fname, 'User', @email, '00000-0000000-0', 'P0000000', '1990-01-01', 'Other')`);
    return repair.recordset[0].applicant_id;
  }
  return null;
}

// POST /api/applicant/application
router.post('/application', async (req, res) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const applicantId = await getApplicantId(pool, req.user.userId);
    if (!applicantId) return res.status(404).json({ error: 'Profile not found' });

    const { visa_type_id, country_id, intended_travel_date, flight_preference, agent_id } = req.body;

    await transaction.begin();

    // 1. Insert Visa Application
    const result = await transaction.request()
      .input('applicant_id', sql.Int, applicantId)
      .input('agent_id', sql.Int, agent_id || null)
      .input('visa_type_id', sql.Int, visa_type_id)
      .input('country_id', sql.Int, country_id)
      .input('travel_date', sql.Date, intended_travel_date)
      .input('flight', sql.VarChar, flight_preference || null)
      .query(`INSERT INTO Visa_Application (applicant_id, agent_id, visa_type_id, country_id, intended_travel_date, flight_preference) 
              OUTPUT INSERTED.application_id 
              VALUES (@applicant_id, @agent_id, @visa_type_id, @country_id, @travel_date, @flight)`);

    const appId = result.recordset[0].application_id;

    // 2. If agent selected, create connection and notify
    if (agent_id) {
      await transaction.request()
        .input('aid', sql.Int, applicantId)
        .input('agid', sql.Int, agent_id)
        .input('appid', sql.Int, appId)
        .query('INSERT INTO Agent_Applicant_Connection (applicant_id, agent_id, application_id, is_approved) VALUES (@aid, @agid, @appid, 0)');

      const agentUserResult = await transaction.request()
        .input('agid', sql.Int, agent_id)
        .query('SELECT user_id FROM Travel_Agent WHERE agent_id=@agid');

      if (agentUserResult.recordset[0]) {
        await transaction.request()
          .input('rid', sql.Int, agentUserResult.recordset[0].user_id)
          .input('sid', sql.Int, req.user.userId)
          .input('ref', sql.Int, appId)
          .query(`INSERT INTO Notifications (receiver_id, sender_id, notification_type, title, message, reference_id) 
                  VALUES (@rid, @sid, 'WORK_REQUEST', 'New Work Request', 'An applicant has selected you as their agent.', @ref)`);
      }
    }

    await transaction.commit();
    res.status(201).json({ message: 'Application submitted successfully', applicationId: appId });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error('Submission Error:', err);
    res.status(500).json({ error: 'Submission failed', details: err.message });
  }
});

// GET /api/applicant/applications
router.get('/applications', async (req, res) => {
  try {
    const pool = await getPool();
    const applicantId = await getApplicantId(pool, req.user.userId);
    const result = await pool.request().input('aid', sql.Int, applicantId)
      .query(`SELECT va.*,vt.visa_name,vt.category AS visa_category,vt.duration_days,vt.base_fee,c.country_name,c.country_code,ta.first_name AS agent_first_name,ta.last_name AS agent_last_name FROM Visa_Application va JOIN Visa_Type vt ON va.visa_type_id=vt.visa_type_id JOIN Country c ON va.country_id=c.country_id LEFT JOIN Travel_Agent ta ON va.agent_id=ta.agent_id WHERE va.applicant_id=@aid AND va.status_id NOT IN ('APPROVED','REJECTED','WITHDRAWN') ORDER BY va.created_at DESC`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/applicant/history
router.get('/history', async (req, res) => {
  try {
    const pool = await getPool();
    const applicantId = await getApplicantId(pool, req.user.userId);
    const result = await pool.request().input('aid', sql.Int, applicantId)
      .query(`SELECT ah.*,vt.visa_name,c.country_name,ta.first_name AS agent_first_name,ta.last_name AS agent_last_name FROM Applicants_History ah JOIN Visa_Type vt ON ah.visa_type_id=vt.visa_type_id JOIN Country c ON ah.country_id=c.country_id LEFT JOIN Travel_Agent ta ON ah.agent_id=ta.agent_id WHERE ah.applicant_id=@aid ORDER BY ah.recorded_at DESC`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/applicant/payment
router.post('/payment', async (req, res) => {
  try {
    const pool = await getPool();
    const { application_id, amount, card_number, expiry_date, cvv } = req.body;

    await pool.request()
      .input('appid', sql.Int, application_id)
      .input('amt', sql.Decimal(10, 2), amount)
      .input('card', sql.VarChar, card_number)
      .input('exp', sql.VarChar, expiry_date)
      .input('cvv', sql.VarChar, cvv)
      .query(`INSERT INTO Payment (application_id, amount, card_number, expiry_date, cvv, payment_status) 
              VALUES (@appid, @amt, @card, @exp, @cvv, 'Paid')`);

    res.status(201).json({ message: 'Payment recorded successfully' });
  } catch (err) {
    console.error('Payment Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/applicant/payments
router.get('/payments', async (req, res) => {
  try {
    const pool = await getPool();
    const applicantId = await getApplicantId(pool, req.user.userId);
    const result = await pool.request().input('aid', sql.Int, applicantId)
      .query(`SELECT p.*,vt.visa_name,c.country_name FROM Payment p JOIN Visa_Application va ON p.application_id=va.application_id JOIN Visa_Type vt ON va.visa_type_id=vt.visa_type_id JOIN Country c ON va.country_id=c.country_id WHERE va.applicant_id=@aid ORDER BY p.payment_date DESC`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/applicant/connection
router.get('/connection', async (req, res) => {
  try {
    const pool = await getPool();
    const applicantId = await getApplicantId(pool, req.user.userId);
    const result = await pool.request().input('aid', sql.Int, applicantId)
      .query(`SELECT aac.*,ta.first_name,ta.last_name,ta.email AS agent_email,ap.rating,ap.hourly_fee,ap.experience_years,ap.available_hours,ap.bio FROM Agent_Applicant_Connection aac JOIN Travel_Agent ta ON aac.agent_id=ta.agent_id LEFT JOIN Agent_Profile ap ON ta.agent_id=ap.agent_id WHERE aac.applicant_id=@aid AND aac.is_active=1`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// DELETE /api/applicant/application/:id
router.delete('/application/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const appId = parseInt(req.params.id);
    const applicantId = await getApplicantId(pool, req.user.userId);

    // Security Check: Ensure this application belongs to the current applicant
    const ownershipCheck = await pool.request()
      .input('appid', sql.Int, appId)
      .input('aid', sql.Int, applicantId)
      .query('SELECT 1 FROM Visa_Application WHERE application_id = @appid AND applicant_id = @aid');

    if (ownershipCheck.recordset.length === 0) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own applications.' });
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

module.exports = router;
