const express              = require('express');
const router               = express.Router();
const pool                 = require('../config/db');
const { protect, restrictTo } = require('../middleware/auth');

// GET all equipment — any logged in user can view
router.get('/', protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, u.full_name AS responsible_person
       FROM equipment e
       LEFT JOIN users u ON e.responsible_user_id = u.id
       ORDER BY e.id ASC`
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single equipment by ID — any logged in user can view
router.get('/:id', protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, u.full_name AS responsible_person
       FROM equipment e
       LEFT JOIN users u ON e.responsible_user_id = u.id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add new equipment — only admins can add
router.post('/', protect, restrictTo('admin'), async (req, res) => {
  const { name, model, serial_number, location, purchase_date, responsible_user_id, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO equipment (name, model, serial_number, location, purchase_date, responsible_user_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, model, serial_number, location, purchase_date, responsible_user_id, notes]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;