# Analytics API Documentation

## Overview

The Analytics API provides comprehensive business intelligence endpoints for monitoring orders, revenue, products, and inventory in the Strapi application.

**Base Path:** `/api/analytic`

## Endpoints

### 1. KPIs (Key Performance Indicators)

**GET** `/api/analytic/kpis?range=30`

Returns order counts and revenue for today, last 7 days, and last N days.

**Query Parameters:**
- `range` (optional): Number of days for the 30-day metric (default: 30, min: 1, max: 365)

**Response:**
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

---

### 2. Revenue by Day

**GET** `/api/analytic/revenue?range=30`

Returns daily revenue breakdown for the specified time period.

**Query Parameters:**
- `range` (optional): Number of days to include (default: 30, min: 1, max: 365)

**Response:**
```json
[
  {
    "date": "2024-01-01",
    "revenue": 1250.50
  },
  {
    "date": "2024-01-02",
    "revenue": 980.25
  }
]
```

---

### 3. Order Status Distribution

**GET** `/api/analytic/order-status`

Returns the count and percentage of orders by status.

**Response:**
```json
[
  {
    "status": "en_preparation",
    "count": 45,
    "percentage": 30
  },
  {
    "status": "livree",
    "count": 90,
    "percentage": 60
  },
  {
    "status": "annulee",
    "count": 15,
    "percentage": 10
  }
]
```

**Available Statuses:**
- `en_preparation` - In preparation
- `produit_non_disponible` - Product unavailable
- `sortie_en_livraison` - Out for delivery
- `probleme_commande` - Order problem
- `livree` - Delivered
- `reportee` - Postponed
- `annulee` - Cancelled

---

### 4. Summary (Combined Endpoint)

**GET** `/api/analytic/summary?range=30`

Returns all analytics data in a single request (KPIs, revenue, and order status).

**Query Parameters:**
- `range` (optional): Number of days for time-based metrics (default: 30, min: 1, max: 365)

**Response:**
```json
{
  "kpis": {
    "ordersToday": 5,
    "orders7d": 42,
    "orders30d": 180,
    "revenueToday": 1250.50,
    "revenue7d": 8900.75,
    "revenue30d": 35000.00
  },
  "revenueByDay": [
    { "date": "2024-01-01", "revenue": 1250.50 }
  ],
  "ordersByStatus": [
    { "status": "livree", "count": 90, "percentage": 60 }
  ]
}
```

---

### 5. Top Products

**GET** `/api/analytic/top-products?range=30&limit=10`

Returns the best-selling products by quantity sold.

**Query Parameters:**
- `range` (optional): Number of days to analyze (default: 30, min: 1, max: 365)
- `limit` (optional): Maximum number of products to return (default: 10, min: 1, max: 50)

**Response:**
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

---

### 6. Low Stock Products

**GET** `/api/analytic/low-stock?threshold=10`

Returns active products with stock levels at or below the specified threshold.

**Query Parameters:**
- `threshold` (optional): Stock level threshold (default: 10, min: 0)

**Response:**
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

---

### 7. Inventory Value

**GET** `/api/analytic/inventory-value`

Returns overall inventory statistics and value.

**Response:**
```json
{
  "totalInventoryValue": 125000.50,
  "totalProducts": 250,
  "totalStock": 5000,
  "lowStockCount": 15,
  "outOfStockCount": 3
}
```

**Metrics:**
- `totalInventoryValue`: Sum of (stock × price) for all active products
- `totalProducts`: Count of active products
- `totalStock`: Sum of stock levels for all active products
- `lowStockCount`: Count of products with stock ≤ 10
- `outOfStockCount`: Count of products with stock = 0

---

## Error Handling

All endpoints return standard HTTP error codes:

- **200 OK**: Successful request
- **400 Bad Request**: Invalid query parameters
- **500 Internal Server Error**: Database or server error

**Error Response Format:**
```json
{
  "error": {
    "status": 500,
    "name": "InternalServerError",
    "message": "Failed to fetch KPIs",
    "details": "Detailed error message"
  }
}
```

---

## Implementation Notes

### Database Queries

- All queries use Knex.js for database abstraction
- Queries are optimized with proper indexing on `created_at` and foreign keys
- Date calculations use MySQL `DATE()` and `DATE_SUB()` functions

### Performance Considerations

1. **Query Optimization**: Queries use aggregations at the database level
2. **Parameter Validation**: Range and limit parameters are bounded to prevent abuse
3. **Caching**: Consider implementing Redis caching for frequently accessed endpoints
4. **Indexes**: Ensure indexes exist on:
   - `orders.created_at`
   - `orders.orderStatus`
   - `order_items.product`
   - `order_items.order`
   - `products.stock`
   - `products.is_active`

### Security

- All endpoints should be protected with appropriate authentication/authorization
- Add policies in route configuration as needed:
  ```typescript
  config: { 
    policies: ['global::is-authenticated'],
    middlewares: [] 
  }
  ```

---

## Future Enhancements

Consider adding:

1. **Customer Analytics**
   - Top customers by order count/revenue
   - Customer lifetime value
   - New vs returning customers

2. **Time Comparisons**
   - Week-over-week growth
   - Month-over-month trends
   - Year-over-year comparisons

3. **Advanced Filtering**
   - Filter by date range (start/end dates)
   - Filter by customer
   - Filter by product category

4. **Caching Layer**
   - Redis caching for expensive queries
   - Cache invalidation on order/product updates

5. **Real-time Updates**
   - WebSocket support for live dashboard updates
   - Server-sent events for notifications

6. **Export Functionality**
   - CSV/Excel export for reports
   - PDF generation for analytics summaries

---

## Testing

To test the endpoints:

```bash
# Get KPIs
curl http://localhost:1337/api/analytic/kpis?range=30

# Get revenue data
curl http://localhost:1337/api/analytic/revenue?range=7

# Get order status distribution
curl http://localhost:1337/api/analytic/order-status

# Get summary
curl http://localhost:1337/api/analytic/summary?range=30

# Get top products
curl http://localhost:1337/api/analytic/top-products?limit=5&range=30

# Get low stock products
curl http://localhost:1337/api/analytic/low-stock?threshold=5

# Get inventory value
curl http://localhost:1337/api/analytic/inventory-value
```
