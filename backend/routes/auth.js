const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');
require('dotenv').config();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role, profileData } = req.body;
    const pool = await getPool();

    // Check if user already exists in Users
    const existing = await pool.request()
      .input('email', sql.VarChar, email)
      .input('username', sql.VarChar, username)
      .query('SELECT user_id FROM Users WHERE email = @email OR username = @username');

    if (existing.recordset.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Check if already pending
    const existingPending = await pool.request()
      .input('email', sql.VarChar, email)
      .input('username', sql.VarChar, username)
      .query('SELECT reg_id FROM Pending_Registrations WHERE (email = @email OR username = @username) AND status = \'PENDING\'');

    if (existingPending.recordset.length > 0) {
      return res.status(400).json({ error: 'A registration request is already pending for this email/username' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    if (role === 'applicant' || role === 'agent') {
      // Store in Pending_Registrations
      await pool.request()
        .input('role', sql.VarChar, role)
        .input('username', sql.VarChar, username)
        .input('email', sql.VarChar, email)
        .input('password_hash', sql.VarChar, passwordHash)
        .input('first_name', sql.VarChar, profileData.first_name)
        .input('last_name', sql.VarChar, profileData.last_name)
        .input('cnic', sql.VarChar, profileData.cnic || null)
        .input('passport_no', sql.VarChar, profileData.passport_no || null)
        .input('dob', sql.Date, profileData.date_of_birth || null)
        .input('gender', sql.VarChar, profileData.gender || null)
        .input('phone', sql.VarChar, profileData.phone || null)
        .input('address', sql.VarChar, profileData.address || null)
        .query(`INSERT INTO Pending_Registrations 
                (role, username, email, password_hash, first_name, last_name, cnic, passport_no, date_of_birth, gender, phone, address)
                VALUES (@role, @username, @email, @password_hash, @first_name, @last_name, @cnic, @passport_no, @dob, @gender, @phone, @address)`);

      return res.status(201).json({
        message: 'Registration request submitted. Pending admin approval.',
        pending: true
      });
    }

    // Admins and others (if any) are created directly (or via existing logic)
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const userResult = await transaction.request()
        .input('username', sql.VarChar, username)
        .input('email', sql.VarChar, email)
        .input('password_hash', sql.VarChar, passwordHash)
        .input('role', sql.VarChar, role)
        .query(`INSERT INTO Users (username, email, password_hash, role) 
                OUTPUT INSERTED.user_id 
                VALUES (@username, @email, @password_hash, @role)`);

      const userId = userResult.recordset[0].user_id;

      if (role === 'admin' && profileData) {
        await transaction.request()
          .input('user_id', sql.Int, userId)
          .input('first_name', sql.VarChar, profileData.first_name)
          .input('last_name', sql.VarChar, profileData.last_name)
          .input('p_email', sql.VarChar, email)
          .query(`INSERT INTO Admin (user_id, first_name, last_name, email)
                  VALUES (@user_id, @first_name, @last_name, @p_email)`);
      }

      await transaction.commit();
      return res.status(201).json({ message: 'Registration successful', userId });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = await getPool();

    // 1. Check main Users table
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');

    if (result.recordset.length === 0) {
      // 2. Check Pending_Registrations table
      const pendingResult = await pool.request()
        .input('email', sql.VarChar, email)
        .query('SELECT * FROM Pending_Registrations WHERE email = @email');

      if (pendingResult.recordset.length > 0) {
        const pendingUser = pendingResult.recordset[0];

        // Verify password for pending/rejected too
        const validPass = await bcrypt.compare(password, pendingUser.password_hash);
        if (!validPass) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (pendingUser.status === 'PENDING') {
          return res.status(403).json({
            error: 'Pending Approval',
            message: 'Your account request is currently being reviewed by an administrator. Please check back later.'
          });
        } else if (pendingUser.status === 'REJECTED') {
          // Rejection message shown once, then delete
          const msg = pendingUser.rejection_note || 'Your registration request was declined by the administrator.';

          await pool.request()
            .input('reg_id', sql.Int, pendingUser.reg_id)
            .query('DELETE FROM Pending_Registrations WHERE reg_id = @reg_id');

          return res.status(403).json({
            error: 'Registration Rejected',
            message: msg + ' (Note: This record has been removed. You may attempt to register again with valid information.)'
          });
        }
      }

      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.recordset[0];

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Account is blocked. Contact admin.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login (This fires the trg_SetOnline trigger)
    await pool.request()
      .input('user_id', sql.Int, user.user_id)
      .query('UPDATE Users SET last_login = GETDATE() WHERE user_id = @user_id');

    // Get role-specific profile
    let profile = {};
    if (user.role === 'applicant') {
      const p = await pool.request()
        .input('user_id', sql.Int, user.user_id)
        .query('SELECT * FROM Applicant WHERE user_id = @user_id');
      profile = p.recordset[0] || {};
    } else if (user.role === 'agent') {
      const p = await pool.request()
        .input('user_id', sql.Int, user.user_id)
        .query(`SELECT ta.*, ap.rating, ap.total_ratings, ap.hourly_fee, ap.experience_years, ap.bio 
                FROM Travel_Agent ta LEFT JOIN Agent_Profile ap ON ta.agent_id = ap.agent_id 
                WHERE ta.user_id = @user_id`);
      profile = p.recordset[0] || {};
    } else if (user.role === 'admin') {
      const p = await pool.request()
        .input('user_id', sql.Int, user.user_id)
        .query('SELECT * FROM Admin WHERE user_id = @user_id');
      profile = p.recordset[0] || {};
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.user_id, role: user.role, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// GET /api/auth/me - Get current user profile
router.get('/me', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, req.user.userId)
      .query('SELECT user_id, username, email, role, is_active, last_login, created_at FROM Users WHERE user_id = @user_id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.recordset[0];
    let profile = {};

    if (user.role === 'applicant') {
      const p = await pool.request().input('uid', sql.Int, user.user_id)
        .query('SELECT * FROM Applicant WHERE user_id = @uid');
      profile = p.recordset[0] || {};
    } else if (user.role === 'agent') {
      const p = await pool.request().input('uid', sql.Int, user.user_id)
        .query(`SELECT ta.*, ap.rating, ap.total_ratings, ap.hourly_fee, ap.experience_years, ap.bio, ap.available_hours
                FROM Travel_Agent ta LEFT JOIN Agent_Profile ap ON ta.agent_id = ap.agent_id 
                WHERE ta.user_id = @uid`);
      profile = p.recordset[0] || {};
    } else if (user.role === 'admin') {
      const p = await pool.request().input('uid', sql.Int, user.user_id)
        .query('SELECT * FROM Admin WHERE user_id = @uid');
      profile = p.recordset[0] || {};
    }

    res.json({ ...user, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const pool = await getPool();
    // Directly set is_active to 0 (Offline)
    await pool.request()
      .input('user_id', sql.Int, req.user.userId)
      .query("UPDATE Users SET is_active = 0 WHERE user_id = @user_id");

    res.json({ message: 'Logout successful and status updated via trigger.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed', details: err.message });
  }
});

module.exports = router;
