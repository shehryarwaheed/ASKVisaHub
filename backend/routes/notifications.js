const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    console.log(`🔔 Fetching notifications for user: ${req.user.userId}`);
    const result = await pool.request().input('uid', sql.Int, req.user.userId)
      .query(`SELECT n.*,u.username AS sender_name FROM Notifications n LEFT JOIN Users u ON n.sender_id=u.user_id WHERE n.receiver_id=@uid ORDER BY n.created_at DESC`);
    console.log(`✅ Found ${result.recordset.length} notifications`);
    res.json(result.recordset);
  } catch (err) { 
    console.error('❌ Notification fetch error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('nid', sql.Int, req.params.id)
      .query('UPDATE Notifications SET is_read=1 WHERE notification_id=@nid');
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().input('uid', sql.Int, req.user.userId)
      .query('UPDATE Notifications SET is_read=1 WHERE receiver_id=@uid');
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().input('uid', sql.Int, req.user.userId)
      .query('SELECT COUNT(*) AS unread FROM Notifications WHERE receiver_id=@uid AND is_read=0');
    res.json(result.recordset[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('nid', sql.Int, req.params.id)
      .input('uid', sql.Int, req.user.userId)
      .query('DELETE FROM Notifications WHERE notification_id=@nid AND receiver_id=@uid');
    res.json({ message: 'Notification deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
