# E-Commerce Analytics Dashboard

## Project Structure
```
/backend      → Express + MySQL2 API (deploy to Railway)
/frontend     → Pure HTML/CSS/JS dashboard (deploy to Vercel)
```

---

## Backend Setup (Railway)

1. Push the `/backend` folder to a GitHub repo
2. Create a new Railway project → "Deploy from GitHub"
3. Add these environment variables in Railway dashboard:
   ```
   DB_HOST=your_railway_mysql_host
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=your_database_name
   PORT=5000
   ```
4. Railway will auto-deploy. Copy the public URL (e.g. `https://yourapp.railway.app`)

---

## Frontend Setup (Vercel)

1. Open `frontend/index.html`
2. Near the top of the `<script>` section, update the API URL:
   ```js
   const API = window.location.hostname === 'localhost'
     ? 'http://localhost:5000'
     : 'https://yourapp.railway.app';  // ← paste your Railway URL here
   ```
3. Push `/frontend` folder to GitHub
4. Go to vercel.com → New Project → import that repo
5. Vercel detects static files automatically → Deploy ✓

---

## Local Development

**Backend:**
```bash
cd backend
npm install
cp .env.example .env   # fill in your DB credentials
npm run dev
```

**Frontend:**
```bash
cd frontend
# just open index.html in your browser, or use:
npx serve .
```

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/dashboard` | KPI metrics |
| `GET /api/orders/status` | Orders by status |
| `GET /api/orders/daily` | Daily orders & revenue |
| `GET /api/orders/top-users` | Top 10 spenders |
| `GET /api/orders/repeat-customers` | Users with >1 order |
| `GET /api/orders/no-orders-users` | Users with zero orders |
| `GET /api/products/popular` | Top 15 products |
| `GET /api/products/variants` | Variant sales |
| `GET /api/products/reviews` | Product ratings |
| `GET /api/products/low-rated` | Products rated < 3★ |
| `GET /api/categories/revenue` | Revenue by category |
| `GET /api/categories/overtime` | Category trends over time |
| `GET /api/users/activity` | Daily active users |
| `GET /api/users/inactive` | Users inactive 30+ days |
| `GET /api/users/city` | Revenue by city |
