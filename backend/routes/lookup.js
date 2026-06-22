const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/lookup/countries
router.get('/countries', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Country ORDER BY country_name');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lookup/visa-types
router.get('/visa-types', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Visa_Type ORDER BY visa_name');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lookup/statuses
router.get('/statuses', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Status_Lookup ORDER BY category, sort_order');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lookup/agents - List agents with profiles (for applicants to choose)
router.get('/agents', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT ta.agent_id, ta.first_name, ta.last_name, ta.email, ta.role AS agent_role,
             c.country_name, c.country_code,
             ap.rating, ap.total_ratings, ap.hourly_fee, ap.experience_years,
             ap.available_hours, ap.bio
      FROM Travel_Agent ta
      LEFT JOIN Agent_Profile ap ON ta.agent_id = ap.agent_id
      LEFT JOIN Country c ON ta.assigned_country = c.country_id
      JOIN Users u ON ta.user_id = u.user_id
      WHERE u.is_blocked = 0
      ORDER BY ap.rating DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
