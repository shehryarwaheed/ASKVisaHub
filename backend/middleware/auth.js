const jwt = require('jsonwebtoken');
require('dotenv').config();

const { sql, getPool } = require('../config/db');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Real-time security check: verify account status in DB
    try {
      const pool = await getPool();
      const dbCheck = await pool.request()
        .input('uid', sql.Int, user.userId)
        .query('SELECT is_blocked, is_active FROM Users WHERE user_id = @uid');

      if (dbCheck.recordset.length === 0) {
        return res.status(401).json({ error: 'User account no longer exists.' });
      }

      const account = dbCheck.recordset[0];
      if (account.is_blocked) {
        return res.status(403).json({ error: 'ACCOUNT_BLOCKED', message: 'Your account has been suspended by an administrator.' });
      }

      req.user = user;
      next();
    } catch (dbErr) {
      console.error('Auth Middleware DB Check Error:', dbErr);
      req.user = user;
      next();
    }
  });
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRoles };
