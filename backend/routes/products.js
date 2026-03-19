// FILE: backend/routes/products.js
const express = require('express');
const router  = express.Router();
const pool    = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM products ORDER BY product_name');
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/top', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM vw_top_products LIMIT 10');
    res.json(rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;