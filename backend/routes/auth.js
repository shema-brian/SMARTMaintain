const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const pool      = require('../config/db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // 1. Check that email and password were provided
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both email and password.'
    });
  }

  try {
    // 2. Find the user by email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = result.rows[0];

    // 3. Compare the provided password with the hashed password in the database
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 4. Generate a JWT token valid for 8 hours
    const token = jwt.sign(
      {
        id:    user.id,
        email: user.email,
        role:  user.role,
        name:  user.full_name
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // 5. Return the token and user info
    res.json({
      success: true,
      message: `Welcome back, ${user.full_name}`,
      token,
      user: {
        id:        user.id,
        full_name: user.full_name,
        email:     user.email,
        role:      user.role,
        phone:     user.phone
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// GET /api/auth/me  —  returns the currently logged in user's info
router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result  = await pool.query(
      'SELECT id, full_name, email, role, phone FROM users WHERE id = $1',
      [decoded.id]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
});

module.exports = router;