// FILE: backend/scripts/dailySummary.js
// Midnight cron — aggregates real events into daily_summary
// Auto-runs via server.js. Manual: node scripts/dailySummary.js

require('dotenv').config({ path: '../.env' });
const pool = require('../db');

async function buildDailySummary(date = null) {
  const target = date || new Date().toISOString().slice(0,10);
  const conn   = await pool.getConnection();
  try {
    const [[s]] = await conn.execute(
      `SELECT
         COUNT(DISTINCT session_id) AS sessions,
         SUM(CASE WHEN event_type='view'      THEN 1 ELSE 0 END) AS views,
         SUM(CASE WHEN event_type='click'     THEN 1 ELSE 0 END) AS clicks,
         SUM(CASE WHEN event_type='cart_add'  THEN 1 ELSE 0 END) AS cart_adds,
         SUM(CASE WHEN event_type='purchase'  THEN 1 ELSE 0 END) AS purchases,
         COALESCE(SUM(revenue),0) AS revenue,
         ROUND(SUM(CASE WHEN event_type='purchase' THEN 1 ELSE 0 END)/
           NULLIF(SUM(CASE WHEN event_type='view' THEN 1 ELSE 0 END),0)*100,2) AS conv,
         ROUND((SUM(CASE WHEN event_type='cart_add' THEN 1 ELSE 0 END)-
           SUM(CASE WHEN event_type='purchase' THEN 1 ELSE 0 END))/
           NULLIF(SUM(CASE WHEN event_type='cart_add' THEN 1 ELSE 0 END),0)*100,2) AS abandon
       FROM events WHERE DATE(created_at)=?`,
      [target]
    );
    await conn.execute(
      `INSERT INTO daily_summary
         (summary_date,total_sessions,total_views,total_clicks,total_cart_adds,
          total_purchases,total_revenue,conversion_rate,cart_abandon_rate)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         total_sessions=VALUES(total_sessions),total_views=VALUES(total_views),
         total_clicks=VALUES(total_clicks),total_cart_adds=VALUES(total_cart_adds),
         total_purchases=VALUES(total_purchases),total_revenue=VALUES(total_revenue),
         conversion_rate=VALUES(conversion_rate),cart_abandon_rate=VALUES(cart_abandon_rate)`,
      [target, s.sessions||0, s.views||0, s.clicks||0, s.cart_adds||0,
       s.purchases||0, s.revenue||0, s.conv||0, s.abandon||0]
    );
    console.log(`✅ Daily summary saved for ${target}`);
  } finally { conn.release(); }
}

if (require.main === module) {
  buildDailySummary().then(()=>process.exit(0)).catch(()=>process.exit(1));
}
module.exports = { buildDailySummary };