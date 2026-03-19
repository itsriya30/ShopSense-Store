-- ================================================================
--  FILE: database/schema.sql
--  HOW TO RUN: Open MySQL Workbench -> paste this -> click Execute
--  This creates the database, all 5 tables, views, and seed products
-- ================================================================

CREATE DATABASE IF NOT EXISTS shopsense_analytics;
USE shopsense_analytics;

-- TABLE 1: products
CREATE TABLE IF NOT EXISTS products (
    product_id    VARCHAR(10)    PRIMARY KEY,
    product_name  VARCHAR(100)   NOT NULL,
    category      VARCHAR(50)    NOT NULL,
    price         DECIMAL(10,2)  NOT NULL,
    created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO products VALUES
('P001', 'iPhone 15 Pro',       'Electronics', 999.00,  NOW()),
('P002', 'Nike Air Max',         'Fashion',     180.00,  NOW()),
('P003', 'MacBook Air M3',       'Electronics', 1299.00, NOW()),
('P004', "Levi's 501 Jeans",     'Fashion',     69.00,   NOW()),
('P005', 'Sony WH-1000XM5',      'Electronics', 349.00,  NOW()),
('P006', 'Adidas Ultraboost',    'Fashion',     190.00,  NOW()),
('P007', 'iPad Pro 12.9',        'Electronics', 1099.00, NOW()),
('P008', 'Protein Powder 2kg',   'Health',      45.00,   NOW());

-- TABLE 2: sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_id       VARCHAR(20)  PRIMARY KEY,
    device_type      ENUM('Mobile', 'Desktop', 'Tablet') NOT NULL,
    location         VARCHAR(60)  NOT NULL,
    traffic_source   VARCHAR(40)  NOT NULL,
    session_duration INT          DEFAULT 0,
    started_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    ended_at         TIMESTAMP    NULL
);

-- TABLE 3: events
CREATE TABLE IF NOT EXISTS events (
    event_id    BIGINT        AUTO_INCREMENT PRIMARY KEY,
    session_id  VARCHAR(20)   NOT NULL,
    product_id  VARCHAR(10)   NOT NULL,
    event_type  ENUM('view','click','cart_add','cart_remove','checkout','purchase') NOT NULL,
    revenue     DECIMAL(10,2) DEFAULT 0.00,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_event_type  (event_type),
    INDEX idx_created_at  (created_at),
    INDEX idx_product_id  (product_id),
    INDEX idx_session_id  (session_id)
);

-- TABLE 4: daily_summary
CREATE TABLE IF NOT EXISTS daily_summary (
    summary_date      DATE          PRIMARY KEY,
    total_sessions    INT           DEFAULT 0,
    total_events      INT           DEFAULT 0,
    total_views       INT           DEFAULT 0,
    total_clicks      INT           DEFAULT 0,
    total_cart_adds   INT           DEFAULT 0,
    total_purchases   INT           DEFAULT 0,
    total_revenue     DECIMAL(12,2) DEFAULT 0.00,
    conversion_rate   DECIMAL(5,2)  DEFAULT 0.00,
    cart_abandon_rate DECIMAL(5,2)  DEFAULT 0.00,
    created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- TABLE 5: product_daily_stats
CREATE TABLE IF NOT EXISTS product_daily_stats (
    id          INT           AUTO_INCREMENT PRIMARY KEY,
    stat_date   DATE          NOT NULL,
    product_id  VARCHAR(10)   NOT NULL,
    views       INT           DEFAULT 0,
    clicks      INT           DEFAULT 0,
    cart_adds   INT           DEFAULT 0,
    purchases   INT           DEFAULT 0,
    revenue     DECIMAL(10,2) DEFAULT 0.00,
    UNIQUE KEY uq_date_product (stat_date, product_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- ================================================================
--  SQL VIEWS — updated to use INTERVAL 7 DAY
-- ================================================================

-- View 1: Real-time KPIs for last 7 days
CREATE OR REPLACE VIEW vw_realtime_kpis AS
SELECT
    COUNT(DISTINCT session_id)                                          AS active_users,
    SUM(CASE WHEN event_type = 'view'      THEN 1 ELSE 0 END)          AS total_views,
    SUM(CASE WHEN event_type = 'click'     THEN 1 ELSE 0 END)          AS total_clicks,
    SUM(CASE WHEN event_type = 'cart_add'  THEN 1 ELSE 0 END)          AS total_cart_adds,
    SUM(CASE WHEN event_type = 'purchase'  THEN 1 ELSE 0 END)          AS total_purchases,
    COALESCE(SUM(revenue), 0)                                           AS total_revenue,
    ROUND(
        SUM(CASE WHEN event_type = 'purchase' THEN 1 ELSE 0 END) /
        NULLIF(SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END), 0) * 100, 2
    )                                                                   AS conversion_rate
FROM events
WHERE created_at >= NOW() - INTERVAL 7 DAY;

-- View 2: Top products ranked by views (last 7 days)
CREATE OR REPLACE VIEW vw_top_products AS
SELECT
    p.product_id,
    p.product_name,
    p.category,
    p.price,
    SUM(CASE WHEN e.event_type = 'view'     THEN 1 ELSE 0 END) AS views,
    SUM(CASE WHEN e.event_type = 'click'    THEN 1 ELSE 0 END) AS clicks,
    SUM(CASE WHEN e.event_type = 'cart_add' THEN 1 ELSE 0 END) AS cart_adds,
    SUM(CASE WHEN e.event_type = 'purchase' THEN 1 ELSE 0 END) AS purchases,
    COALESCE(SUM(e.revenue), 0)                                  AS revenue
FROM products p
LEFT JOIN events e
    ON p.product_id = e.product_id
    AND e.created_at >= NOW() - INTERVAL 7 DAY
GROUP BY p.product_id, p.product_name, p.category, p.price
ORDER BY views DESC;

-- View 3: Hourly traffic for last 7 days
CREATE OR REPLACE VIEW vw_hourly_traffic AS
SELECT
    DATE_FORMAT(created_at, '%Y-%m-%d %H:00')                     AS hour_slot,
    COUNT(*)                                                        AS event_count,
    COUNT(DISTINCT session_id)                                      AS unique_users,
    SUM(CASE WHEN event_type = 'purchase' THEN revenue ELSE 0 END) AS revenue
FROM events
WHERE created_at >= NOW() - INTERVAL 7 DAY
GROUP BY hour_slot
ORDER BY hour_slot;

-- ================================================================
--  VERIFY: Run these to confirm everything was created correctly
-- ================================================================
-- SHOW TABLES;
-- SELECT * FROM products;
-- DESCRIBE events;
