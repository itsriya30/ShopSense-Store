// ================================================================
//  FILE: backend/server.js
//
//  REAL-TIME FLOW:
//    Real user does something in store
//    → tracker.js POSTs to /api/events
//    → saved to MySQL
//    → Socket.io broadcasts IMMEDIATELY to dashboard
//    → Dashboard updates LIVE without refresh
//
//  Also pushes on schedule:
//    KPIs        every 5 seconds
//    Funnel      every 10 seconds
//    Hourly      every 15 seconds
//    Products    every 20 seconds
//    Traffic     every 30 seconds
//    Devices     every 30 seconds
// ================================================================

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const cron       = require('node-cron');
const pool       = require('./db');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin:  ['http://localhost:3000','http://localhost:3001','http://localhost:3002'],
    methods: ['GET','POST','PUT'],
  },
});
app.set('io', io);

app.use(cors({ origin: ['http://localhost:3000','http://localhost:3001','http://localhost:3002'] }));
app.use(express.json());

app.use('/api/events',    require('./routes/events'));
app.use('/api/sessions',  require('./routes/sessions'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/analytics', require('./routes/analytics'));
app.get('/api/health', (_,res) => res.json({ status:'ok', time:new Date().toISOString() }));

// ── Broadcast helpers ────────────────────────────────────────────

async function broadcastKPIs() {
  try {
    const [[k]]   = await pool.execute('SELECT * FROM vw_realtime_kpis');
    const [[avg]] = await pool.execute(
      `SELECT COALESCE(ROUND(AVG(session_duration)),0) AS avg_session
       FROM sessions WHERE started_at >= NOW() - INTERVAL 24 HOUR`
    );
    const abandon = k.total_cart_adds > 0
      ? (((k.total_cart_adds - k.total_purchases) / k.total_cart_adds)*100).toFixed(1)
      : '0';
    io.emit('kpi_update', {
      ...k,
      cart_abandon_rate: abandon,
      avg_session:       avg.avg_session || 0,
      updated_at:        new Date().toISOString(),
    });
  } catch(e) { console.error('broadcastKPIs:', e.message); }
}

async function broadcastFunnel() {
  try {
    const [[c]] = await pool.execute(
      `SELECT
         SUM(CASE WHEN event_type='view'      THEN 1 ELSE 0 END) AS views,
         SUM(CASE WHEN event_type='click'     THEN 1 ELSE 0 END) AS clicks,
         SUM(CASE WHEN event_type='cart_add'  THEN 1 ELSE 0 END) AS cart_adds,
         SUM(CASE WHEN event_type='checkout'  THEN 1 ELSE 0 END) AS checkouts,
         SUM(CASE WHEN event_type='purchase'  THEN 1 ELSE 0 END) AS purchases
       FROM events WHERE created_at >= NOW() - INTERVAL 24 HOUR`
    );
    io.emit('funnel_update', [
      { stage:'Views',       value: c.views     || 0 },
      { stage:'Clicks',      value: c.clicks    || 0 },
      { stage:'Add to Cart', value: c.cart_adds || 0 },
      { stage:'Checkout',    value: c.checkouts || 0 },
      { stage:'Purchase',    value: c.purchases || 0 },
    ]);
  } catch(e) { console.error('broadcastFunnel:', e.message); }
}

async function broadcastHourly() {
  try {
    const [rows] = await pool.execute('SELECT * FROM vw_hourly_traffic ORDER BY hour_slot ASC');
    io.emit('hourly_update', rows.map(r => ({ ...r, time: r.hour_slot ? r.hour_slot.slice(11,16) : '' })));
  } catch(e) { console.error('broadcastHourly:', e.message); }
}

async function broadcastProducts() {
  try {
    const [rows] = await pool.execute('SELECT * FROM vw_top_products LIMIT 10');
    io.emit('products_update', rows);
  } catch(e) { console.error('broadcastProducts:', e.message); }
}

async function broadcastTraffic() {
  try {
    const [rows] = await pool.execute(
      `SELECT traffic_source AS source, COUNT(*) AS count
       FROM sessions WHERE started_at >= NOW() - INTERVAL 24 HOUR
       GROUP BY traffic_source ORDER BY count DESC`
    );
    io.emit('traffic_update', rows);
  } catch(e) { console.error('broadcastTraffic:', e.message); }
}

async function broadcastDevices() {
  try {
    const [rows] = await pool.execute(
      `SELECT device_type AS type, COUNT(*) AS count
       FROM sessions WHERE started_at >= NOW() - INTERVAL 24 HOUR
       GROUP BY device_type ORDER BY count DESC`
    );
    io.emit('devices_update', rows);
  } catch(e) { console.error('broadcastDevices:', e.message); }
}

async function broadcastAll() {
  await Promise.all([
    broadcastKPIs(), broadcastFunnel(), broadcastHourly(),
    broadcastProducts(), broadcastTraffic(), broadcastDevices(),
  ]);
}

// ── Socket connections ───────────────────────────────────────────
let clients = 0;
io.on('connection', async socket => {
  clients++;
  console.log(`🔌  Dashboard connected (${clients} total)`);
  await broadcastAll();
  socket.on('disconnect', () => { clients--; });
});

// ── Push schedules ───────────────────────────────────────────────
setInterval(() => { if(clients>0) broadcastKPIs();    },  5000);
setInterval(() => { if(clients>0) broadcastFunnel();  }, 10000);
setInterval(() => { if(clients>0) broadcastHourly();  }, 15000);
setInterval(() => { if(clients>0) broadcastProducts();}, 20000);
setInterval(() => { if(clients>0) { broadcastTraffic(); broadcastDevices(); }}, 30000);

// ── Midnight cron: daily summary ─────────────────────────────────
cron.schedule('0 0 * * *', async () => {
  try {
    const { buildDailySummary } = require('./scripts/dailySummary');
    await buildDailySummary();
  } catch(e) { console.error('Cron:', e.message); }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  🚀  ShopSense backend → port ${PORT}        ║`);
  console.log(`║  📡  Real-time push active               ║`);
  console.log(`║  🔴  Zero fake data — real users only    ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});