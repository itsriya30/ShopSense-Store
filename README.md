# ShopSense Analytics

A full-stack real-time e-commerce analytics platform. A React store app silently tracks every user action and streams it live to an analytics dashboard via Socket.io.

## What it does

- Every action in the store (view, click, add to cart, checkout, purchase) is tracked silently in the background
- Events are saved to MySQL and instantly broadcast to the dashboard via WebSockets
- Dashboard shows live KPIs, charts, funnel analysis, and a real-time event stream

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend Store | React |
| Analytics Dashboard | React + Recharts + Chart.js |
| Backend | Node.js + Express + Socket.io |
| Database | MySQL |

## Project Structure

```
shopsense-analytics/
├── backend/          # Express API + Socket.io server
│   ├── routes/       # events, sessions, products, analytics
│   ├── scripts/      # daily summary cron job
│   ├── db.js         # MySQL connection pool
│   └── server.js     # main server + real-time broadcasts
├── frontend/         # Analytics dashboard (React)
│   └── src/
│       └── Dashboard.jsx
└── database/
    └── schema.sql    # All tables + views
```

## Getting Started

### 1. Database

Open MySQL Workbench and run `database/schema.sql` — this creates the database, tables, views, and seeds the 8 products.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set your MySQL password
npm install
node server.js
```

Runs on `http://localhost:5000`

### 3. Dashboard

```bash
cd frontend
npm install
npm start
```

Runs on `http://localhost:3000`

### 4. Store

```bash
cd store   # separate repo / folder
npm install
npm start
```

Runs on `http://localhost:3001`

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=shopsense_analytics
PORT=5000
```

## Features

- Real-time event stream with live updates
- KPI cards — sessions, revenue, cart abandon rate, avg session
- Hourly traffic line chart
- Top products by views (bar chart)
- Conversion funnel (pie + bar)
- Traffic sources & device breakdown (donut charts)
- Revenue over time (area chart)
- Category filter on sidebar
- Silent analytics — store looks like a normal e-commerce site
