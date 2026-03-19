// ================================================================
//  FILE: backend/scripts/seed.js
//  PURPOSE: Insert realistic fake data so the dashboard has
//           something to show immediately when you open it.
//
//  RUN ONCE: node scripts/seed.js
//
//  WHAT IT CREATES:
//    - 60 sessions spread across the last 24 hours
//    - 500 events (views, clicks, purchases etc.)
//    - Events are weighted realistically:
//        40% views, 30% clicks, 20% cart_adds,
//        5% cart_removes, 3% checkouts, 2% purchases
// ================================================================

require('dotenv').config({ path: '../.env' });
const pool = require('../db');

// ── Seed data constants ──────────────────────────────────────────
const PRODUCTS = ['P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008'];
const DEVICES  = ['Mobile', 'Desktop', 'Tablet'];
const LOCATIONS = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad', 'Kolkata'];
const SOURCES = ['Google', 'Instagram', 'Direct', 'Email', 'YouTube'];

// Weighted event types — more views than purchases (realistic)
const EVENT_TYPES = [
    'view', 'view', 'view', 'view',          // 4 views   = 40%
    'click', 'click', 'click',               // 3 clicks  = 30%
    'cart_add', 'cart_add',                  // 2 cart    = 20%
    'cart_remove',                           // 1 remove  = 5%
    'checkout',                              // 1 checkout= 3%  (approx)
    'purchase',                              // 1 purchase= 2%  (approx)
];

// Product prices — needed to set revenue for purchases
const PRODUCT_PRICES = {
    P001: 999,   // iPhone 15 Pro
    P002: 180,   // Nike Air Max
    P003: 1299,  // MacBook Air M3
    P004: 69,    // Levi's 501
    P005: 349,   // Sony Headphones
    P006: 190,   // Adidas Ultraboost
    P007: 1099,  // iPad Pro
    P008: 45,    // Protein Powder
};

// ── Helper functions ─────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr)      => arr[Math.floor(Math.random() * arr.length)];

// ── Main seed function ───────────────────────────────────────────
async function seed() {
    console.log('');
    console.log('🌱  Starting database seed...');
    console.log('');

    const conn = await pool.getConnection();

    try {
        // ── STEP 1: Insert 60 sessions ───────────────────────────
        console.log('   Creating 60 sessions...');
        const sessionIds = [];

        for (let i = 1; i <= 60; i++) {
            const sessionId    = `S${1000 + i}`;
            const minutesAgo   = rand(1, 1440);   // random time in last 24 hours

            sessionIds.push(sessionId);

            await conn.execute(
                `INSERT IGNORE INTO sessions
                 (session_id, device_type, location, traffic_source, session_duration, started_at)
                 VALUES(?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
                [
                    sessionId,
                    pick(DEVICES),
                    pick(LOCATIONS),
                    pick(SOURCES),
                    rand(30, 600),      // session duration: 30 sec to 10 min
                    minutesAgo,
                ]
            );
        }

        console.log('   ✅  60 sessions inserted');

        // ── STEP 2: Insert 500 events ────────────────────────────
        console.log('   Creating 500 events...');

        for (let i = 0; i < 500; i++) {
            const sessionId  = pick(sessionIds);
            const productId  = pick(PRODUCTS);
            const eventType  = pick(EVENT_TYPES);
            const revenue    = eventType === 'purchase' ? PRODUCT_PRICES[productId] : 0;
            const minutesAgo = rand(1, 1440);

            await conn.execute(
                `INSERT INTO events
                 (session_id, product_id, event_type, revenue, created_at)
                 VALUES(?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
                [sessionId, productId, eventType, revenue, minutesAgo]
            );
        }

        console.log('   ✅  500 events inserted');

        // ── Done ─────────────────────────────────────────────────
        console.log('');
        console.log('🎉  Seed complete!');
        console.log('   Now start the backend: npm run dev');
        console.log('   Then start the frontend: npm start');
        console.log('');

    } catch (err) {
        console.error('❌  Seed failed:', err.message);
        console.error(err);
    } finally {
        conn.release();
        process.exit(0);
    }
}

seed();
