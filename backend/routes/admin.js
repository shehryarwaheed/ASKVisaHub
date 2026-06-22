const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken, authorizeRoles('admin'));

// GET /api/admin/dashboard-stats
router.get('/dashboard-stats', async (req, res) => {
  try {
    const pool = await getPool();
    console.log('📊 Fetching dashboard statistics...');

    const tables = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Blacklisted_Applicants'");
    const existingTables = tables.recordset.map(t => t.TABLE_NAME);
    const hasBlacklist = existingTables.includes('Blacklisted_Applicants');

    const r = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM Visa_Application WHERE status_id NOT IN ('APPROVED','REJECTED','WITHDRAWN')) AS active_applications,
        (SELECT COUNT(*) FROM Visa_Application) AS total_applications,
        (SELECT COUNT(*) FROM Applicants_History WHERE final_status='APPROVED') AS total_approved,
        (SELECT COUNT(*) FROM Applicants_History WHERE final_status='REJECTED') AS total_rejected,
        (SELECT COUNT(*) FROM Applicant) AS total_applicants,
        (SELECT COUNT(DISTINCT a.applicant_id) FROM Applicant a JOIN Visa_Application va ON a.applicant_id=va.applicant_id WHERE va.status_id NOT IN ('APPROVED','REJECTED','WITHDRAWN')) AS active_applicants,
        (SELECT COUNT(*) FROM Travel_Agent) AS total_agents,
        (SELECT COUNT(DISTINCT ta.agent_id) FROM Travel_Agent ta JOIN Visa_Application va ON ta.agent_id=ta.agent_id WHERE va.status_id NOT IN ('APPROVED','REJECTED','WITHDRAWN')) AS active_agents,
        ${hasBlacklist ? "(SELECT COUNT(*) FROM Blacklisted_Applicants)" : "0"} AS blacklisted_count
    `);
    console.log('✅ Stats fetched successfully');
    res.json(r.recordset[0]);
  } catch (err) {
    console.error('❌ Stats fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/applications
router.get('/applications', async (req, res) => {
  try {
    const pool = await getPool();
    console.log('📊 Fetching all applications...');
    const result = await pool.request().query(`
      SELECT va.*,vt.visa_name,c.country_name,a.first_name AS app_first,a.last_name AS app_last,
             ta.first_name AS agent_first,ta.last_name AS agent_last
      FROM Visa_Application va
      JOIN Visa_Type vt ON va.visa_type_id=vt.visa_type_id
      JOIN Country c ON va.country_id=c.country_id
      JOIN Applicant a ON va.applicant_id=a.applicant_id
      LEFT JOIN Travel_Agent ta ON va.agent_id=ta.agent_id
      ORDER BY va.created_at DESC`);
    console.log(`✅ Found ${result.recordset.length} applications`);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Applications fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/history
router.get('/history', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT ah.*,vt.visa_name,c.country_name,a.first_name AS app_first,a.last_name AS app_last,
             ta.first_name AS agent_first,ta.last_name AS agent_last
      FROM Applicants_History ah
      JOIN Visa_Type vt ON ah.visa_type_id=vt.visa_type_id
      JOIN Country c ON ah.country_id=c.country_id
      JOIN Applicant a ON ah.applicant_id=a.applicant_id
      LEFT JOIN Travel_Agent ta ON ah.agent_id=ta.agent_id
      ORDER BY ah.recorded_at DESC`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/applicants
router.get('/applicants', async (req, res) => {
  try {
    const pool = await getPool();
    console.log('👥 Fetching registered applicants...');

    // Check if Blacklisted_Applicants table exists first
    const tableCheck = await pool.request().query("SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Blacklisted_Applicants'");

    let query = `
      SELECT a.*,u.username,u.is_active,u.last_login,u.created_at AS user_created,
        (SELECT COUNT(*) FROM Visa_Application va WHERE va.applicant_id=a.applicant_id) AS total_apps
      FROM Applicant a 
      JOIN Users u ON a.user_id=u.user_id`;

    if (tableCheck.recordset.length > 0) {
      query += ` WHERE a.applicant_id NOT IN (SELECT applicant_id FROM Blacklisted_Applicants)`;
    }

    query += ` ORDER BY a.first_name`;

    const result = await pool.request().query(query);
    console.log(`✅ Found ${result.recordset.length} applicants`);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Applicants fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/agents
router.get('/agents', async (req, res) => {
  try {
    const pool = await getPool();
    console.log('👮 Fetching agent registry...');
    const result = await pool.request().query(`
      SELECT ta.*,u.username,u.is_active,ap.rating,ap.total_ratings,ap.hourly_fee,ap.experience_years,c.country_name,
        (SELECT COUNT(*) FROM Visa_Application va WHERE va.agent_id=ta.agent_id AND va.status_id NOT IN ('APPROVED','REJECTED','WITHDRAWN')) AS active_apps,
        (SELECT COUNT(*) FROM Applicants_History ah WHERE ah.agent_id=ta.agent_id AND ah.final_status='APPROVED') AS approved_count,
        (SELECT COUNT(*) FROM Applicants_History ah WHERE ah.agent_id=ta.agent_id AND ah.final_status='REJECTED') AS rejected_count
      FROM Travel_Agent ta JOIN Users u ON ta.user_id=u.user_id LEFT JOIN Agent_Profile ap ON ta.agent_id=ap.agent_id LEFT JOIN Country c ON ta.assigned_country=c.country_id ORDER BY ta.first_name`);
    console.log(`✅ Found ${result.recordset.length} agents`);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Agents fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});



// POST /api/admin/blacklist
router.post('/blacklist', async (req, res) => {
  try {
    const pool = await getPool();
    const { applicant_id, agent_id, reason } = req.body;

    // 1. Record in minimal blacklist table
    await pool.request()
      .input('aid', sql.Int, applicant_id)
      .input('agid', sql.Int, agent_id || null)
      .input('amid', sql.Int, req.user.userId)
      .input('r', sql.VarChar, reason)
      .query('INSERT INTO Blacklisted_Applicants (applicant_id, agent_id, admin_id, reason) VALUES (@aid, @agid, @amid, @r)');

    // 2. Deactivate the user account
    const app = await pool.request().input('aid', sql.Int, applicant_id).query('SELECT user_id FROM Applicant WHERE applicant_id=@aid');
    if (app.recordset[0]) {
      await pool.request().input('uid', sql.Int, app.recordset[0].user_id).query('UPDATE Users SET is_blocked=1 WHERE user_id=@uid');
    }

    res.status(201).json({ message: 'Applicant blacklisted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/blacklisted
router.get('/blacklisted', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT ba.*, a.first_name, a.last_name, u.email, adm.username AS admin_name
      FROM Blacklisted_Applicants ba
      JOIN Applicant a ON ba.applicant_id = a.applicant_id
      JOIN Users u ON a.user_id = u.user_id
      JOIN Users adm ON ba.admin_id = adm.user_id
      ORDER BY ba.created_at DESC`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/unblock/:blacklistId
router.delete('/unblock/:blacklistId', async (req, res) => {
  try {
    const pool = await getPool();
    const bl = await pool.request().input('bid', sql.Int, req.params.blacklistId)
      .query('SELECT applicant_id FROM Blacklisted_Applicants WHERE blacklist_id=@bid');

    if (bl.recordset[0]) {
      const aid = bl.recordset[0].applicant_id;
      const app = await pool.request().input('aid', sql.Int, aid).query('SELECT user_id FROM Applicant WHERE applicant_id=@aid');
      if (app.recordset[0]) {
        await pool.request().input('uid', sql.Int, app.recordset[0].user_id).query('UPDATE Users SET is_blocked=0 WHERE user_id=@uid');
      }
      await pool.request().input('bid', sql.Int, req.params.blacklistId).query('DELETE FROM Blacklisted_Applicants WHERE blacklist_id=@bid');
    }
    res.json({ message: 'User unblocked' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/reports
router.get('/reports', async (req, res) => {
  try {
    const pool = await getPool();
    const { start_date, end_date } = req.query;
    let query = `SELECT ah.*,vt.visa_name,vt.duration_days,c.country_name,a.first_name AS app_first,a.last_name AS app_last,
      ta.first_name AS agent_first,ta.last_name AS agent_last
      FROM Applicants_History ah JOIN Visa_Type vt ON ah.visa_type_id=vt.visa_type_id JOIN Country c ON ah.country_id=c.country_id
      JOIN Applicant a ON ah.applicant_id=a.applicant_id LEFT JOIN Travel_Agent ta ON ah.agent_id=ta.agent_id WHERE 1=1`;
    const request = pool.request();
    if (start_date) { query += ' AND ah.recorded_at >= @sd'; request.input('sd', sql.DateTime2, start_date); }
    if (end_date) { query += ' AND ah.recorded_at <= @ed'; request.input('ed', sql.DateTime2, end_date); }
    query += ' ORDER BY ah.recorded_at DESC';
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/rate-agent/:agentId
router.put('/rate-agent/:agentId', async (req, res) => {
  try {
    const pool = await getPool();
    const { rating } = req.body;
    const agentId = req.params.agentId;

    const result = await pool.request()
      .input('agid', sql.Int, agentId)
      .input('r', sql.Decimal(3, 2), rating)
      .query(`
        IF EXISTS (SELECT 1 FROM Agent_Profile WHERE agent_id = @agid)
        BEGIN
          UPDATE Agent_Profile SET rating = @r, total_ratings = 1 WHERE agent_id = @agid;
        END
        ELSE
        BEGIN
          INSERT INTO Agent_Profile (agent_id, rating, total_ratings, hourly_fee, experience_years)
          VALUES (@agid, @r, 1, 0, 0);
        END
      `);

    res.json({ message: 'Agent rating updated successfully in profile' });
  } catch (err) {
    console.error('Error updating agent profile rating:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/pending-registrations
router.get('/pending-registrations', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Pending_Registrations WHERE status = \'PENDING\' ORDER BY created_at DESC');
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/approve-registration/:id
router.post('/approve-registration/:id', async (req, res) => {
  const transaction = new sql.Transaction(await getPool());
  try {
    await transaction.begin();
    const regId = req.params.id;

    // 1. Get the pending data
    const regDataResult = await transaction.request()
      .input('reg_id', sql.Int, regId)
      .query('SELECT * FROM Pending_Registrations WHERE reg_id = @reg_id AND status = \'PENDING\'');

    if (regDataResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Registration request not found or already processed' });
    }

    const data = regDataResult.recordset[0];

    // 2. Insert into Users
    const userResult = await transaction.request()
      .input('username', sql.VarChar, data.username)
      .input('email', sql.VarChar, data.email)
      .input('password_hash', sql.VarChar, data.password_hash)
      .input('role', sql.VarChar, data.role)
      .query(`INSERT INTO Users (username, email, password_hash, role) 
              OUTPUT INSERTED.user_id 
              VALUES (@username, @email, @password_hash, @role)`);

    const userId = userResult.recordset[0].user_id;

    // 3. Insert into role-specific tables
    if (data.role === 'applicant') {
      await transaction.request()
        .input('user_id', sql.Int, userId)
        .input('first_name', sql.VarChar, data.first_name)
        .input('last_name', sql.VarChar, data.last_name)
        .input('cnic', sql.VarChar, data.cnic)
        .input('passport_no', sql.VarChar, data.passport_no)
        .input('dob', sql.Date, data.date_of_birth)
        .input('gender', sql.VarChar, data.gender)
        .input('phone', sql.VarChar, data.phone)
        .input('email', sql.VarChar, data.email)
        .input('address', sql.VarChar, data.address)
        .query(`INSERT INTO Applicant (user_id, first_name, last_name, cnic, passport_no, date_of_birth, gender, phone, email, address)
                VALUES (@user_id, @first_name, @last_name, @cnic, @passport_no, @dob, @gender, @phone, @email, @address)`);
    } else if (data.role === 'agent') {
      const agentResult = await transaction.request()
        .input('user_id', sql.Int, userId)
        .input('first_name', sql.VarChar, data.first_name)
        .input('last_name', sql.VarChar, data.last_name)
        .input('email', sql.VarChar, data.email)
        .query(`INSERT INTO Travel_Agent (user_id, first_name, last_name, email)
                VALUES (@user_id, @first_name, @last_name, @email);
                SELECT SCOPE_IDENTITY() AS agent_id;`);

      const agentId = agentResult.recordset[0].agent_id;
    }

    // 4. Delete from pending
    await transaction.request()
      .input('reg_id', sql.Int, regId)
      .query('DELETE FROM Pending_Registrations WHERE reg_id = @reg_id');

    await transaction.commit();
    res.json({ message: 'Registration approved successfully' });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error('Approval Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/reject-registration/:id
router.post('/reject-registration/:id', async (req, res) => {
  try {
    const { reason } = req.body;
    const pool = await getPool();
    await pool.request()
      .input('reg_id', sql.Int, req.params.id)
      .input('note', sql.VarChar, reason || 'Registration declined by administrator.')
      .query('UPDATE Pending_Registrations SET status = \'REJECTED\', rejection_note = @note WHERE reg_id = @reg_id');

    res.json({ message: 'Registration rejected' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/search
router.get('/search', async (req, res) => {
  try {
    const pool = await getPool();
    const query = req.query.q;
    if (!query || query.length < 2) return res.json({ applicants: [], agents: [] });

    const searchPattern = `%${query}%`;

    // Search Applicants
    const applicants = await pool.request()
      .input('p', sql.VarChar, searchPattern)
      .query(`
        SELECT a.*, u.username, u.is_active, 'applicant' as role,
               (SELECT COUNT(*) FROM Visa_Application va WHERE va.applicant_id=a.applicant_id) AS total_apps
        FROM Applicant a 
        JOIN Users u ON a.user_id = u.user_id 
        WHERE a.first_name LIKE @p OR a.last_name LIKE @p OR a.email LIKE @p OR u.username LIKE @p
      `);

    // Search Agents
    const agents = await pool.request()
      .input('p', sql.VarChar, searchPattern)
      .query(`
        SELECT ta.*, u.username, u.is_active, 'agent' as role,
               (SELECT COUNT(*) FROM Visa_Application va WHERE va.agent_id=ta.agent_id) AS total_apps
        FROM Travel_Agent ta 
        JOIN Users u ON ta.user_id = u.user_id 
        WHERE ta.first_name LIKE @p OR ta.last_name LIKE @p OR ta.email LIKE @p OR u.username LIKE @p
      `);

    res.json({ applicants: applicants.recordset, agents: agents.recordset });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
