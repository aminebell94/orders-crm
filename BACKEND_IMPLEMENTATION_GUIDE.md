# Backend Implementation Guide - Analytics API

## Current Status

The analytics API has been implemented and fixed with the following improvements:

### ✅ Fixed Issues
1. **Critical bug in `summary` endpoint** - Fixed incorrect service name and broken ctx.clone() logic
2. **Schema field mismatch** - Changed `status` to `orderStatus` to match database schema
3. **Added comprehensive error handling** - All endpoints now have try-catch blocks
4. **Added parameter validation** - Range (1-365 days) and limit (1-50 items) are bounded
5. **Removed unused variables** - Cleaned up code quality issues

### ✅ New Features Added
1. **Top Products endpoint** (`/api/analytic/top-products`) - Best-selling products analysis
2. **Low Stock endpoint** (`/api/analytic/low-stock`) - Inventory alerts
3. **Inventory Value endpoint** (`/api/analytic/inventory-value`) - Complete inventory metrics

---

## Next Steps for Backend

### 1. Restart Strapi Server

```bash
# Stop current server (Ctrl+C)
npm run build
npm run develop
```

### 2. Test All Endpoints

After server restart, test each endpoint:

```bash
# Test KPIs
curl http://localhost:1337/api/analytic/kpis

# Test Revenue
curl http://localhost:1337/api/analytic/revenue?range=7

# Test Order Status
curl http://localhost:1337/api/analytic/order-status

# Test Summary (combined)
curl http://localhost:1337/api/analytic/summary

# Test Top Products
curl http://localhost:1337/api/analytic/top-products?limit=5

# Test Low Stock
curl http://localhost:1337/api/analytic/low-stock?threshold=10

# Test Inventory Value
curl http://localhost:1337/api/analytic/inventory-value
```

### 3. Add Authentication/Authorization (Recommended)

Currently, all endpoints are public. Add authentication:

**Option A: Require authentication for all analytics endpoints**

Edit `src/api/analytic/routes/custom-analytics.ts`:

```typescript
export default {
  routes: [
    {
      method: 'GET',
      path: '/analytic/kpis',
      handler: 'analytic.kpis',
      config: { 
        policies: ['global::is-authenticated'],  // Add this
        middlewares: [] 
      },
    },
    // ... repeat for all routes
  ],
};
```

**Option B: Use role-based access control**

```typescript
config: { 
  policies: [
    'global::is-authenticated',
    {
      name: 'plugin::users-permissions.permissions',
      config: {
        actions: ['api::analytic.analytic.kpis']
      }
    }
  ],
  middlewares: [] 
}
```

### 4. Add Database Indexes (Performance)

For optimal query performance, ensure these indexes exist:

```sql
-- Orders table
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_orderStatus ON orders(orderStatus);

-- Order Items table
CREATE INDEX idx_order_items_product ON order_items(product);
CREATE INDEX idx_order_items_order ON order_items(order);

-- Products table
CREATE INDEX idx_products_stock ON products(stock);
CREATE INDEX idx_products_is_active ON products(is_active);
```

### 5. Add Caching (Optional but Recommended)

Install Redis caching for expensive queries:

```bash
npm install @strapi/provider-cache-redis
```

Configure in `config/plugins.ts`:

```typescript
export default {
  cache: {
    enabled: true,
    config: {
      provider: 'redis',
      providerOptions: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
      },
    },
  },
};
```

Then wrap expensive queries:

```typescript
async kpis(ctx) {
  const cacheKey = `analytics:kpis:${ctx.request.query.range || 30}`;
  
  let data = await strapi.cache.get(cacheKey);
  if (data) {
    ctx.body = data;
    return;
  }
  
  // ... existing query logic ...
  
  await strapi.cache.set(cacheKey, ctx.body, { ttl: 300 }); // 5 min cache
}
```

### 6. Add Rate Limiting (Security)

Install rate limiting middleware:

```bash
npm install koa-ratelimit
```

Configure in `config/middlewares.ts`:

```typescript
export default [
  // ... other middlewares
  {
    name: 'strapi::ratelimit',
    config: {
      interval: { min: 1 },
      max: 100, // 100 requests per minute
      prefixKey: 'analytics:',
    },
  },
];
```

### 7. Add Logging and Monitoring

Add structured logging for analytics queries:

```typescript
async kpis(ctx) {
  const startTime = Date.now();
  try {
    // ... existing logic ...
    
    strapi.log.info('Analytics KPI query', {
      duration: Date.now() - startTime,
      range: ctx.request.query.range,
      user: ctx.state.user?.id,
    });
  } catch (error) {
    strapi.log.error('Analytics KPI query failed', {
      error: error.message,
      duration: Date.now() - startTime,
    });
    throw error;
  }
}
```

### 8. Add Input Validation (Enhanced Security)

Install validation library:

```bash
npm install joi
```

Add validation middleware:

```typescript
import Joi from 'joi';

const validateKpisQuery = async (ctx, next) => {
  const schema = Joi.object({
    range: Joi.number().integer().min(1).max(365).optional(),
  });
  
  const { error } = schema.validate(ctx.request.query);
  if (error) {
    return ctx.badRequest('Invalid query parameters', { details: error.details });
  }
  
  await next();
};

// Use in routes:
config: { 
  policies: [],
  middlewares: [validateKpisQuery] 
}
```

---

## Testing Checklist

- [ ] All 7 endpoints return 200 OK with valid data
- [ ] Error handling works (test with invalid parameters)
- [ ] Query parameters are validated (range, limit, threshold)
- [ ] Database queries are optimized (check query execution time)
- [ ] Authentication is enforced (if added)
- [ ] Rate limiting works (if added)
- [ ] Caching works (if added)
- [ ] Logs are being generated properly

---

## Common Issues and Solutions

### Issue: "Handler not found"
**Solution:** Rebuild and restart Strapi
```bash
npm run build
npm run develop
```

### Issue: Slow query performance
**Solution:** Add database indexes (see step 4 above)

### Issue: orderStatus returns empty
**Solution:** Verify the field name in your database matches `orderStatus` (camelCase)

### Issue: CORS errors from frontend
**Solution:** Configure CORS in `config/middlewares.ts`:
```typescript
{
  name: 'strapi::cors',
  config: {
    origin: ['http://localhost:3000'], // Your frontend URL
    credentials: true,
  },
}
```

---

## API Response Examples

### KPIs Response
```json
{
  "ordersToday": 5,
  "orders7d": 42,
  "orders30d": 180,
  "revenueToday": 1250.50,
  "revenue7d": 8900.75,
  "revenue30d": 35000.00
}
```

### Top Products Response
```json
[
  {
    "productId": 123,
    "name": "Product Name",
    "sku": "SKU-001",
    "totalQuantity": 150,
    "totalRevenue": 7500.00,
    "orderCount": 45
  }
]
```

### Low Stock Response
```json
[
  {
    "productId": 456,
    "name": "Product Name",
    "sku": "SKU-002",
    "stock": 5,
    "price": 49.99,
    "isActive": true
  }
]
```

### Inventory Value Response
```json
{
  "totalInventoryValue": 125000.50,
  "totalProducts": 250,
  "totalStock": 5000,
  "lowStockCount": 15,
  "outOfStockCount": 3
}
```

---

## Future Enhancements

Consider implementing:

1. **Customer Analytics**
   - Top customers by revenue
   - Customer lifetime value
   - New vs returning customers

2. **Time Comparisons**
   - Week-over-week growth percentages
   - Month-over-month trends
   - Year-over-year comparisons

3. **Advanced Filtering**
   - Filter by specific date ranges (start/end dates)
   - Filter by customer segments
   - Filter by product categories

4. **Export Functionality**
   - CSV export for reports
   - PDF generation for summaries
   - Scheduled email reports

5. **Real-time Updates**
   - WebSocket support for live dashboards
   - Server-sent events for notifications

6. **Predictive Analytics**
   - Sales forecasting
   - Inventory optimization recommendations
   - Demand prediction

---

## Support

For issues or questions:
1. Check the README.md in `src/api/analytic/`
2. Review Strapi documentation: https://docs.strapi.io
3. Check database query logs for performance issues
4. Verify all environment variables are set correctly
