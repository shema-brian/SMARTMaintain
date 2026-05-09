const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
const equipmentRoutes = require('./routes/equipment');
const scheduleRoutes  = require('./routes/schedules');
const alertRoutes     = require('./routes/alerts');
const authRoutes      = require('./routes/auth');
const userRoutes      = require('./routes/users');

app.use('/api/equipment', equipmentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/alerts',    alertRoutes);
app.use('/api/auth',      authRoutes);
app.use('/api/users',      userRoutes);

// Health check route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SMARTMaintain API is running.',
    version: '1.0.0',
    client:  'Masaka Farms, Kigali Rwanda'
  });
});

// Start cron job
require('./jobs/scheduler');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`------------------------------------------`);
  console.log(`SMARTMaintain server running on port ${PORT}`);
  console.log(`Client: Masaka Farms, Kigali Rwanda`);
  console.log(`------------------------------------------`);
});