// FILE: backend/scripts/seed.js
// Run: node scripts/seed.js
// Seeds 28 days of realistic e-commerce event data

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../db');

const PRODUCTS = [
  { id:'P001', price:999  },
  { id:'P002', price:180  },
  { id:'P003', price:1299 },
  { id:'P004', price:69   },
  { id:'P005', price:349  },
  { id:'P006', price:190  },
  { id:'P007', price:1099 },
  { id:'P008', price:45   },
];

const DEVICES   = ['Mobile','Desktop','Tablet'];
const LOCATIONS = ['India','Mumbai','Delhi','Bangalore','London','New York','Dubai','Singapore'];
const SOURCES   = ['Google','Direct','Instagram','Facebook','YouTube','Other'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randFloat(min, max) { return +(Math.random() * (max - min) + min).toFixed(2); }

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('Clearing old data...');
    await conn.execute('SET FOREIGN_KEY_CHECKS=0');
    await conn.execute('TRUNCATE TABLE events');
    await conn.execute('TRUNCATE TABLE sessions');
    await conn.execute('SET FOREIGN_KEY_CHECKS=1');

    const now = new Date();
    let sessionRows = [];
    let eventRows   = [];

    console.log('Generating 28 days of data...');

    for (let day = 27; day >= 0; day--) {
      // More sessions on recent days
      const sessionsToday = rand(15, 60);

      for (let s = 0; s < sessionsToday; s++) {
        const sid      = 'U' + (now.getTime() - day*86400000) + s + Math.random().toString(36).slice(2,5).toUpperCase();
        const device   = pick(DEVICES);
        const location = pick(LOCATIONS);
        const source   = pick(SOURCES);
        const duration = rand(30, 600);

        // Session started_at = random time during that day
        const startedAt = new Date(now);
        startedAt.setDate(now.getDate() - day);
        startedAt.setHours(rand(0,23), rand(0,59), rand(0,59), 0);

        sessionRows.push([sid, device, location, source, duration, startedAt]);

        // Each session views 2-6 products
        const viewCount = rand(2, 6);
        const viewedProducts = [...PRODUCTS].sort(() => Math.random()-0.5).slice(0, viewCount);

        for (const prod of viewedProducts) {
          const evTime = new Date(startedAt.getTime() + rand(5,60)*1000);

          // view
          eventRows.push([sid, prod.id, 'view', 0, evTime]);

          // 50% chance click
          if (Math.random() < 0.5) {
            eventRows.push([sid, prod.id, 'click', 0, new Date(evTime.getTime() + rand(3,15)*1000)]);

            // 35% chance cart_add
            if (Math.random() < 0.35) {
              eventRows.push([sid, prod.id, 'cart_add', 0, new Date(evTime.getTime() + rand(10,30)*1000)]);

              // 40% chance checkout
              if (Math.random() < 0.4) {
                eventRows.push([sid, prod.id, 'checkout', 0, new Date(evTime.getTime() + rand(20,60)*1000)]);

                // 60% chance purchase
                if (Math.random() < 0.6) {
                  eventRows.push([sid, prod.id, 'purchase', prod.price, new Date(evTime.getTime() + rand(30,90)*1000)]);
                }
              }
            }
          }
        }
      }
    }

    // Batch insert sessions
    console.log(`Inserting ${sessionRows.length} sessions...`);
    for (let i = 0; i < sessionRows.length; i += 100) {
      const batch = sessionRows.slice(i, i+100);
      const placeholders = batch.map(() => '(?,?,?,?,?,?)').join(',');
      const flat = batch.flat();
      await conn.execute(
        `INSERT IGNORE INTO sessions (session_id,device_type,location,traffic_source,session_duration,started_at) VALUES ${placeholders}`,
        flat
      );
    }

    // Batch insert events
    console.log(`Inserting ${eventRows.length} events...`);
    for (let i = 0; i < eventRows.length; i += 200) {
      const batch = eventRows.slice(i, i+200);
      const placeholders = batch.map(() => '(?,?,?,?,?)').join(',');
      const flat = batch.flat();
      await conn.execute(
        `INSERT INTO events (session_id,product_id,event_type,revenue,created_at) VALUES ${placeholders}`,
        flat
      );
    }

    console.log('Done! Seed complete.');
    console.log(`Sessions: ${sessionRows.length}`);
    console.log(`Events:   ${eventRows.length}`);
  } catch(err) {
    console.error('Seed error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
