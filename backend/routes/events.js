// FILE: backend/routes/events.js
//
// THE CORE OF REAL-TIME TRACKING:
//   1. tracker.js POSTs real user action here
//   2. Saved to MySQL
//   3. Socket.io broadcasts to ALL open dashboards instantly
//   4. Dashboard updates live — no refresh needed

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

const VALID = ['view','click','cart_add','cart_remove','checkout','purchase'];

// POST /api/events — real user did something
router.post('/', async (req, res) => {
  const { session_id, product_id, event_type, revenue = 0 } = req.body;

  if (!session_id || !product_id || !event_type)
    return res.status(400).json({ error: 'Missing session_id, product_id, or event_type' });
  if (!VALID.includes(event_type))
    return res.status(400).json({ error: `event_type must be: ${VALID.join(', ')}` });

  try {
    // Save to MySQL
    const [result] = await pool.execute(
      `INSERT INTO events (session_id, product_id, event_type, revenue)
       VALUES (?, ?, ?, ?)`,
      [session_id, product_id, event_type, event_type==='purchase' ? revenue : 0]
    );

    // Fetch full event details with product name + session info
    const [rows] = await pool.execute(
      `SELECT e.event_id, e.session_id, e.event_type, e.revenue, e.created_at,
              p.product_name, p.category, p.price,
              s.device_type, s.location, s.traffic_source
       FROM events e
       JOIN products p ON e.product_id = p.product_id
       JOIN sessions s ON e.session_id = s.session_id
       WHERE e.event_id = ?`,
      [result.insertId]
    );

    // Broadcast INSTANTLY to all open dashboards
    req.app.get('io').emit('new_event', rows[0]);

    res.status(201).json({ success: true, event: rows[0] });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/live — last 100 events for dashboard on load
router.get('/live', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT e.event_id, e.session_id, e.event_type, e.revenue, e.created_at,
              p.product_name, p.category,
              s.device_type, s.location, s.traffic_source
       FROM events e
       JOIN products p ON e.product_id = p.product_id
       JOIN sessions s ON e.session_id = s.session_id
       ORDER BY e.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;