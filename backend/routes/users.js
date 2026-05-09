const express              = require('express');
const router               = express.Router();
const pool                 = require('../config/db');
const { protect, restrictTo } = require('../middleware/auth');

// GET all users — admin and manager only
router.get('/', protect, restrictTo('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, is_active, created_at
       FROM users
       ORDER BY role ASC, full_name ASC`
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all technicians only — used when assigning tasks
router.get('/technicians', protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone
       FROM users
       WHERE role = 'technician' AND is_active = true
       ORDER BY full_name ASC`
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single user by ID
router.get('/:id', protect, restrictTo('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, is_active, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;