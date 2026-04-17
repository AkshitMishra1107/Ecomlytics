const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Helper
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    const [[{ total_revenue }]] = await pool.execute(
      'SELECT COALESCE(SUM(total_amount),0) AS total_revenue FROM orders'
    );
    const [[{ total_orders }]] = await pool.execute(
      'SELECT COUNT(*) AS total_orders FROM orders'
    );
    const [[{ total_users }]] = await pool.execute(
      'SELECT COUNT(*) AS total_users FROM users'
    );
    const [[{ avg_order_value }]] = await pool.execute(
      'SELECT COALESCE(AVG(total_amount),0) AS avg_order_value FROM orders'
    );
    const [[{ total_products }]] = await pool.execute(
      'SELECT COUNT(*) AS total_products FROM products'
    );
    const [[{ pending_orders }]] = await pool.execute(
      "SELECT COUNT(*) AS pending_orders FROM orders WHERE status='Pending'"
    );
    const [[{ delivered_orders }]] = await pool.execute(
      "SELECT COUNT(*) AS delivered_orders FROM orders WHERE status='Delivered'"
    );
    const [[{ cancelled_orders }]] = await pool.execute(
      "SELECT COUNT(*) AS cancelled_orders FROM orders WHERE status='Cancelled'"
    );
    const [[{ orders_last7 }]] = await pool.execute(
      "SELECT COUNT(*) AS orders_last7 FROM orders WHERE order_date >= NOW() - INTERVAL 7 DAY"
    );
    const [[{ avg_items_per_order }]] = await pool.execute(
      'SELECT COALESCE(AVG(item_count),0) AS avg_items_per_order FROM (SELECT COUNT(*) AS item_count FROM order_items GROUP BY order_id) t'
    );

    res.json({
      total_revenue, total_orders, total_users, avg_order_value,
      total_products, pending_orders, delivered_orders, cancelled_orders,
      orders_last7, avg_items_per_order,
      queries: {
        total_revenue: 'SELECT SUM(total_amount) FROM orders',
        total_orders: 'SELECT COUNT(*) FROM orders',
        total_users: 'SELECT COUNT(*) FROM users',
        avg_order_value: 'SELECT AVG(total_amount) FROM orders',
        total_products: 'SELECT COUNT(*) FROM products',
        pending_orders: "SELECT COUNT(*) FROM orders WHERE status='Pending'",
        delivered_orders: "SELECT COUNT(*) FROM orders WHERE status='Delivered'",
        cancelled_orders: "SELECT COUNT(*) FROM orders WHERE status='Cancelled'",
        orders_last7: 'SELECT COUNT(*) FROM orders WHERE order_date >= NOW() - INTERVAL 7 DAY',
        avg_items_per_order: 'SELECT AVG(item_count) FROM (SELECT COUNT(*) AS item_count FROM order_items GROUP BY order_id) t',
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ORDER ANALYTICS ─────────────────────────────────────────────────────────
app.get('/api/orders/status', async (req, res) => {
  try {
    const data = await query('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
    res.json({ data, sql: 'SELECT status, COUNT(*) AS count FROM orders GROUP BY status' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/daily', async (req, res) => {
  try {
    const data = await query('SELECT DATE(order_date) AS date, COUNT(*) AS orders, SUM(total_amount) AS revenue FROM orders GROUP BY DATE(order_date) ORDER BY date');
    res.json({
      data,
      sql: 'SELECT DATE(order_date) AS date, COUNT(*) AS orders, SUM(total_amount) AS revenue FROM orders GROUP BY DATE(order_date) ORDER BY date'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/top-users', async (req, res) => {
  try {
    const data = await query(
      'SELECT u.name, u.email, COUNT(o.order_id) AS orders, SUM(o.total_amount) AS spend FROM orders o JOIN users u ON o.user_id = u.user_id GROUP BY o.user_id, u.name, u.email ORDER BY spend DESC LIMIT 10'
    );
    res.json({
      data,
      sql: 'SELECT u.name, u.email, COUNT(o.order_id) AS orders, SUM(o.total_amount) AS spend\nFROM orders o JOIN users u ON o.user_id = u.user_id\nGROUP BY o.user_id ORDER BY spend DESC LIMIT 10'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/repeat-customers', async (req, res) => {
  try {
    const data = await query(
      'SELECT u.name, u.email, COUNT(o.order_id) AS order_count FROM orders o JOIN users u ON o.user_id = u.user_id GROUP BY o.user_id, u.name, u.email HAVING COUNT(o.order_id) > 1 ORDER BY order_count DESC'
    );
    res.json({
      data,
      sql: 'SELECT user_id, COUNT(*) AS order_count FROM orders\nGROUP BY user_id HAVING COUNT(*) > 1\nORDER BY order_count DESC'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/no-orders-users', async (req, res) => {
  try {
    const data = await query(
      'SELECT u.user_id, u.name, u.email, u.city, u.signup_date FROM users u WHERE u.user_id NOT IN (SELECT user_id FROM orders)'
    );
    res.json({
      data,
      sql: 'SELECT * FROM users WHERE user_id NOT IN (SELECT user_id FROM orders)'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PRODUCT ANALYTICS ───────────────────────────────────────────────────────
app.get('/api/products/popular', async (req, res) => {
  try {
    const data = await query(
      'SELECT p.product_name, c.category_name, SUM(oi.quantity) AS units_sold, SUM(oi.quantity * oi.price_at_purchase) AS revenue FROM order_items oi JOIN product_variants pv ON oi.variant_id = pv.variant_id JOIN products p ON pv.product_id = p.product_id JOIN categories c ON p.category_id = c.category_id GROUP BY p.product_id, p.product_name, c.category_name ORDER BY units_sold DESC LIMIT 15'
    );
    res.json({
      data,
      sql: 'SELECT p.product_name, SUM(oi.quantity) AS units_sold\nFROM order_items oi\nJOIN product_variants pv ON oi.variant_id = pv.variant_id\nJOIN products p ON pv.product_id = p.product_id\nGROUP BY p.product_name ORDER BY units_sold DESC LIMIT 15'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/variants', async (req, res) => {
  try {
    const data = await query(
      'SELECT p.product_name, pv.variant_name, SUM(oi.quantity) AS sales, SUM(oi.quantity * oi.price_at_purchase) AS revenue FROM order_items oi JOIN product_variants pv ON oi.variant_id = pv.variant_id JOIN products p ON pv.product_id = p.product_id GROUP BY oi.variant_id, p.product_name, pv.variant_name ORDER BY sales DESC LIMIT 20'
    );
    res.json({
      data,
      sql: 'SELECT pv.variant_name, SUM(oi.quantity) AS sales, SUM(oi.quantity * oi.price_at_purchase) AS revenue\nFROM order_items oi JOIN product_variants pv ON oi.variant_id = pv.variant_id\nGROUP BY oi.variant_id ORDER BY sales DESC LIMIT 20'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/reviews', async (req, res) => {
  try {
    const data = await query(
      'SELECT p.product_name, AVG(r.rating) AS avg_rating, COUNT(r.review_id) AS review_count FROM reviews r JOIN products p ON r.product_id = p.product_id GROUP BY r.product_id, p.product_name ORDER BY avg_rating DESC'
    );
    res.json({
      data,
      sql: 'SELECT p.product_name, AVG(r.rating) AS avg_rating, COUNT(*) AS review_count\nFROM reviews r JOIN products p ON r.product_id = p.product_id\nGROUP BY r.product_id ORDER BY avg_rating DESC'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/low-rated', async (req, res) => {
  try {
    const data = await query(
      'SELECT p.product_name, AVG(r.rating) AS avg_rating, COUNT(r.review_id) AS review_count FROM reviews r JOIN products p ON r.product_id = p.product_id GROUP BY r.product_id, p.product_name HAVING AVG(r.rating) < 3 ORDER BY avg_rating ASC'
    );
    res.json({
      data,
      sql: 'SELECT product_id, AVG(rating) AS avg_rating FROM reviews\nGROUP BY product_id HAVING AVG(rating) < 3\nORDER BY avg_rating ASC'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── CATEGORY ANALYTICS ──────────────────────────────────────────────────────
app.get('/api/categories/revenue', async (req, res) => {
  try {
    const data = await query(
      'SELECT c.category_name, SUM(oi.quantity * oi.price_at_purchase) AS revenue, COUNT(DISTINCT o.order_id) AS orders FROM order_items oi JOIN orders o ON oi.order_id = o.order_id JOIN product_variants pv ON oi.variant_id = pv.variant_id JOIN products p ON pv.product_id = p.product_id JOIN categories c ON p.category_id = c.category_id GROUP BY c.category_name ORDER BY revenue DESC'
    );
    res.json({
      data,
      sql: 'SELECT c.category_name, SUM(oi.quantity * oi.price_at_purchase) AS revenue\nFROM order_items oi\nJOIN product_variants pv ON oi.variant_id = pv.variant_id\nJOIN products p ON pv.product_id = p.product_id\nJOIN categories c ON p.category_id = c.category_id\nGROUP BY c.category_name ORDER BY revenue DESC'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/categories/overtime', async (req, res) => {
  try {
    const data = await query(
      'SELECT c.category_name, DATE(o.order_date) AS date, SUM(oi.quantity * oi.price_at_purchase) AS revenue FROM order_items oi JOIN orders o ON oi.order_id = o.order_id JOIN product_variants pv ON oi.variant_id = pv.variant_id JOIN products p ON pv.product_id = p.product_id JOIN categories c ON p.category_id = c.category_id GROUP BY c.category_name, DATE(o.order_date) ORDER BY date'
    );
    res.json({
      data,
      sql: 'SELECT c.category_name, DATE(o.order_date) AS date, SUM(oi.quantity * oi.price_at_purchase) AS revenue\nFROM order_items oi JOIN orders o ON oi.order_id = o.order_id\nJOIN product_variants pv ON oi.variant_id = pv.variant_id\nJOIN products p ON pv.product_id = p.product_id\nJOIN categories c ON p.category_id = c.category_id\nGROUP BY c.category_name, DATE(o.order_date) ORDER BY date'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── USER ANALYTICS ──────────────────────────────────────────────────────────
app.get('/api/users/activity', async (req, res) => {
  try {
    const data = await query(
      'SELECT DATE(login_time) AS date, COUNT(DISTINCT user_id) AS active_users, COUNT(*) AS total_logins FROM user_logins GROUP BY DATE(login_time) ORDER BY date'
    );
    res.json({
      data,
      sql: 'SELECT DATE(login_time) AS date, COUNT(DISTINCT user_id) AS active_users\nFROM user_logins\nGROUP BY DATE(login_time) ORDER BY date'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/inactive', async (req, res) => {
  try {
    const data = await query(
      'SELECT u.name, u.email, u.city, MAX(ul.login_time) AS last_login FROM users u JOIN user_logins ul ON u.user_id = ul.user_id GROUP BY u.user_id, u.name, u.email, u.city HAVING MAX(ul.login_time) < NOW() - INTERVAL 30 DAY ORDER BY last_login ASC'
    );
    res.json({
      data,
      sql: 'SELECT user_id, MAX(login_time) AS last_login FROM user_logins\nGROUP BY user_id\nHAVING MAX(login_time) < NOW() - INTERVAL 30 DAY\nORDER BY last_login ASC'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/city', async (req, res) => {
  try {
    const data = await query(
      'SELECT city, COUNT(*) AS user_count, COALESCE(SUM(o.total_amount),0) AS total_revenue FROM users u LEFT JOIN orders o ON u.user_id = o.user_id GROUP BY city ORDER BY total_revenue DESC'
    );
    res.json({
      data,
      sql: 'SELECT city, COUNT(*) AS user_count, SUM(o.total_amount) AS total_revenue\nFROM users u LEFT JOIN orders o ON u.user_id = o.user_id\nGROUP BY city ORDER BY total_revenue DESC'
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
