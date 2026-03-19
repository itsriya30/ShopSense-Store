// FILE: backend/routes/analytics.js
const express = require('express');
const router  = express.Router();
const pool    = require('../db');

router.get('/kpis', async (req, res) => {
  try {
    const [[k]]    = await pool.execute('SELECT * FROM vw_realtime_kpis');
    const [[sess]] = await pool.execute(
      `SELECT COUNT(*) AS total_sessions FROM sessions WHERE started_at >= NOW() - INTERVAL 7 DAY`
    );
    const [[avg]]  = await pool.execute(
      `SELECT COALESCE(ROUND(AVG(session_duration)),0) AS avg_session
       FROM sessions WHERE started_at >= NOW() - INTERVAL 7 DAY`
    );
    const abandon = k.total_cart_adds > 0
      ? (((k.total_cart_adds - k.total_purchases)/k.total_cart_adds)*100).toFixed(1)
      : '0';
    const totalSessions = Number(sess.total_sessions) || Number(k.active_users) || 0;
    res.json({
      ...k,
      total_sessions: totalSessions,
      total_events: (Number(k.total_views||0) + Number(k.total_clicks||0) + Number(k.total_cart_adds||0) + Number(k.total_purchases||0)),
      cart_abandon_rate: abandon,
      avg_session: avg.avg_session || 0
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/funnel', async (req, res) => {
  try {
    const [[c]] = await pool.execute(
      `SELECT
         SUM(CASE WHEN event_type='view'      THEN 1 ELSE 0 END) AS views,
         SUM(CASE WHEN event_type='click'     THEN 1 ELSE 0 END) AS clicks,
         SUM(CASE WHEN event_type='cart_add'  THEN 1 ELSE 0 END) AS cart_adds,
         SUM(CASE WHEN event_type='checkout'  THEN 1 ELSE 0 END) AS checkouts,
         SUM(CASE WHEN event_type='purchase'  THEN 1 ELSE 0 END) AS purchases
       FROM events WHERE created_at >= NOW() - INTERVAL 7 DAY`
    );
    res.json([
      { stage:'Views',       value: c.views     ||0 },
      { stage:'Clicks',      value: c.clicks    ||0 },
      { stage:'Add to Cart', value: c.cart_adds ||0 },
      { stage:'Checkout',    value: c.checkouts ||0 },
      { stage:'Purchase',    value: c.purchases ||0 },
    ]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/hourly', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM vw_hourly_traffic ORDER BY hour_slot ASC');
    res.json(rows.map(r => ({ ...r, time: r.hour_slot ? r.hour_slot.slice(11,16) : '' })));
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/traffic', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT traffic_source AS source, COUNT(*) AS count
       FROM sessions WHERE started_at >= NOW() - INTERVAL 7 DAY
       GROUP BY traffic_source ORDER BY count DESC`
    );
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/devices', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT device_type AS type, COUNT(*) AS count
       FROM sessions WHERE started_at >= NOW() - INTERVAL 7 DAY
       GROUP BY device_type ORDER BY count DESC`
    );
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
