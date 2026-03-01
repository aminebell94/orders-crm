# Frontend Integration Guide - Analytics API

## 🔴 Current Issue

**Frontend is calling:**
```
http://localhost:3001/api/strapi/analytics/summary?range=30
```

**Backend is serving:**
```
http://localhost:1337/api/analytic/summary?range=30
```

**Result:** 404 Not Found

---

## ✅ Solution: Update Frontend API Calls

### Step 1: Identify Your Frontend Framework

- **React/Vue/Angular**: Update API service/utility files
- **Next.js**: Can use proxy or direct calls
- **Plain JavaScript**: Update fetch/axios calls

---

## 📝 Frontend Code Examples

### Example 1: Using Fetch API

```javascript
// config/api.js or utils/api.js
const STRAPI_URL = 'http://localhost:1337';
const API_BASE = `${STRAPI_URL}/api`;

export const analyticsAPI = {
  // Get KPIs
  getKPIs: async (range = 30) => {
    const response = await fetch(`${API_BASE}/analytic/kpis?range=${range}`);
    if (!response.ok) throw new Error('Failed to fetch KPIs');
    return response.json();
  },

  // Get revenue data
  getRevenue: async (range = 30) => {
    const response = await fetch(`${API_BASE}/analytic/revenue?range=${range}`);
    if (!response.ok) throw new Error('Failed to fetch revenue');
    return response.json();
  },

  // Get order status distribution
  getOrderStatus: async () => {
    const response = await fetch(`${API_BASE}/analytic/order-status`);
    if (!response.ok) throw new Error('Failed to fetch order status');
    return response.json();
  },

  // Get summary (all data)
  getSummary: async (range = 30) => {
    const response = await fetch(`${API_BASE}/analytic/summary?range=${range}`);
    if (!response.ok) throw new Error('Failed to fetch summary');
    return response.json();
  },

  // Get top products
  getTopProducts: async (range = 30, limit = 10) => {
    const response = await fetch(
      `${API_BASE}/analytic/top-products?range=${range}&limit=${limit}`
    );
    if (!response.ok) throw new Error('Failed to fetch top products');
    return response.json();
  },

  // Get low stock products
  getLowStock: async (threshold = 10) => {
    const response = await fetch(
      `${API_BASE}/analytic/low-stock?threshold=${threshold}`
    );
    if (!response.ok) throw new Error('Failed to fetch low stock');
    return response.json();
  },

  // Get inventory value
  getInventoryValue: async () => {
    const response = await fetch(`${API_BASE}/analytic/inventory-value`);
    if (!response.ok) throw new Error('Failed to fetch inventory value');
    return response.json();
  },
};
```

### Example 2: Using Axios

```javascript
// config/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:1337/api',
  timeout: 10000,
});

export const analyticsAPI = {
  getKPIs: (range = 30) => 
    api.get('/analytic/kpis', { params: { range } }),
  
  getRevenue: (range = 30) => 
    api.get('/analytic/revenue', { params: { range } }),
  
  getOrderStatus: () => 
    api.get('/analytic/order-status'),
  
  getSummary: (range = 30) => 
    api.get('/analytic/summary', { params: { range } }),
  
  getTopProducts: (range = 30, limit = 10) => 
    api.get('/analytic/top-products', { params: { range, limit } }),
  
  getLowStock: (threshold = 10) => 
    api.get('/analytic/low-stock', { params: { threshold } }),
  
  getInventoryValue: () => 
    api.get('/analytic/inventory-value'),
};
```

### Example 3: React Hook

```javascript
// hooks/useAnalytics.js
import { useState, useEffect } from 'react';
import { analyticsAPI } from '../config/api';

export const useAnalytics = (range = 30) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await analyticsAPI.getSummary(range);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [range]);

  return { data, loading, error };
};

// Usage in component:
function Dashboard() {
  const { data, loading, error } = useAnalytics(30);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>KPIs</h1>
      <p>Orders Today: {data.kpis.ordersToday}</p>
      <p>Revenue Today: ${data.kpis.revenueToday}</p>
    </div>
  );
}
```

---

## 🔧 Environment Variables (Recommended)

Create a `.env` file in your frontend:

```env
# .env.local (for Next.js) or .env (for React/Vite)
NEXT_PUBLIC_STRAPI_URL=http://localhost:1337
# or
VITE_STRAPI_URL=http://localhost:1337
# or
REACT_APP_STRAPI_URL=http://localhost:1337
```

Then use in your code:

```javascript
// Next.js
const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL;

// Vite
const STRAPI_URL = import.meta.env.VITE_STRAPI_URL;

// Create React App
const STRAPI_URL = process.env.REACT_APP_STRAPI_URL;

const API_BASE = `${STRAPI_URL}/api`;
```

---

## 🌐 CORS Configuration

If you get CORS errors, update Strapi's CORS settings:

**File:** `config/middlewares.ts` (in your Strapi backend)

```typescript
export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: ['http://localhost:3000', 'http://localhost:3001'], // Add your frontend URLs
      credentials: true,
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
```

---

## 📊 Complete Dashboard Example

```javascript
// components/AnalyticsDashboard.jsx
import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../config/api';

function AnalyticsDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await analyticsAPI.getSummary(range);
        setSummary(data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [range]);

  if (loading) return <div>Loading analytics...</div>;
  if (!summary) return <div>No data available</div>;

  return (
    <div className="analytics-dashboard">
      <h1>Analytics Dashboard</h1>
      
      {/* Range Selector */}
      <select value={range} onChange={(e) => setRange(Number(e.target.value))}>
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
      </select>

      {/* KPIs */}
      <div className="kpis">
        <div className="kpi-card">
          <h3>Orders Today</h3>
          <p>{summary.kpis.ordersToday}</p>
        </div>
        <div className="kpi-card">
          <h3>Revenue Today</h3>
          <p>${summary.kpis.revenueToday.toFixed(2)}</p>
        </div>
        <div className="kpi-card">
          <h3>Orders ({range}d)</h3>
          <p>{summary.kpis.orders30d}</p>
        </div>
        <div className="kpi-card">
          <h3>Revenue ({range}d)</h3>
          <p>${summary.kpis.revenue30d.toFixed(2)}</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="revenue-chart">
        <h2>Revenue by Day</h2>
        {summary.revenueByDay.map((day) => (
          <div key={day.date}>
            {day.date}: ${day.revenue.toFixed(2)}
          </div>
        ))}
      </div>

      {/* Order Status */}
      <div className="order-status">
        <h2>Order Status Distribution</h2>
        {summary.ordersByStatus.map((status) => (
          <div key={status.status}>
            {status.status}: {status.count} ({status.percentage}%)
          </div>
        ))}
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
```

---

## 🔍 Debugging Tips

### 1. Check if Backend is Running
```bash
curl http://localhost:1337/api/analytic/summary?range=30
```

### 2. Check Network Tab
- Open browser DevTools → Network tab
- Look for the failed request
- Check the actual URL being called
- Check the response status and error message

### 3. Test with Postman/Insomnia
```
GET http://localhost:1337/api/analytic/summary?range=30
```

### 4. Check Console for Errors
```javascript
// Add detailed logging
fetch('http://localhost:1337/api/analytic/summary?range=30')
  .then(res => {
    console.log('Response status:', res.status);
    console.log('Response headers:', res.headers);
    return res.json();
  })
  .then(data => console.log('Data:', data))
  .catch(err => console.error('Error:', err));
```

---

## 📋 Quick Checklist

- [ ] Update API base URL to `http://localhost:1337/api`
- [ ] Change endpoint path from `/analytics/` to `/analytic/`
- [ ] Remove `/strapi/` from the path
- [ ] Test each endpoint individually
- [ ] Configure CORS in backend if needed
- [ ] Use environment variables for API URL
- [ ] Add error handling for failed requests
- [ ] Test with different query parameters

---

## 🎯 Summary

**Change this:**
```javascript
fetch('http://localhost:3001/api/strapi/analytics/summary?range=30')
```

**To this:**
```javascript
fetch('http://localhost:1337/api/analytic/summary?range=30')
```

That's it! The backend is ready and working. You just need to update the frontend URLs.
