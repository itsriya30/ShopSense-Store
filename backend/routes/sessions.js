// FILE: backend/routes/sessions.js
// Called by tracker.js when user opens/closes the store

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// POST /api/sessions — user opened the store
router.post('/', async (req, res) => {
  const { session_id, device_type, location, traffic_source } = req.body;
  if (!session_id || !device_type || !location || !traffic_source)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    await pool.execute(
      `INSERT IGNORE INTO sessions (session_id, device_type, location, traffic_source)
       VALUES (?, ?, ?, ?)`,
      [session_id, device_type, location, traffic_source]
    );
    // broadcast so dashboard KPIs update instantly
    req.app.get('io').emit('new_session', { session_id, device_type, location, traffic_source });
    res.status(201).json({ success: true, session_id });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sessions/:id — user left the store
router.put('/:id', async (req, res) => {
  const { session_duration } = req.body;
  try {
    await pool.execute(
      `UPDATE sessions SET session_duration=?, ended_at=NOW() WHERE session_id=?`,
      [session_duration || 0, req.params.id]
    );
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;