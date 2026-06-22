const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { getPool } = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const lookupRoutes = require('./routes/lookup');
const applicantRoutes = require('./routes/applicant');
const agentRoutes = require('./routes/agent');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');
app.use('/api/auth', authRoutes);
app.use('/api/lookup', lookupRoutes);
app.use('/api/applicant', applicantRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'VMS Backend is running' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await getPool();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
