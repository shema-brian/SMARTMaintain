const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');

// GET all alert logs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT al.*, u.full_name AS sent_to_name, u.email AS sent_to_email
       FROM alert_logs al
       LEFT JOIN users u ON al.sent_to_user = u.id
       ORDER BY al.sent_at DESC`
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;