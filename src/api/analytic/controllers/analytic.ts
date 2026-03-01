import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::analytic.analytic', ({ strapi }) => ({
  async kpis(ctx) {
    try {
      const days = Math.min(Math.max(Number(ctx.request.query.range || 30), 1), 365);
      const knex = strapi.db.connection;

      // counts
      const { c_today } = await knex('orders')
        .count<{ c_today: number }>({ c_today: '*' })
        .whereRaw('DATE(created_at) = CURDATE()')
        .first();

      const { c_7 } = await knex('orders')
        .count<{ c_7: number }>({ c_7: '*' })
        .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL 7 DAY)'))
        .first();

      const { c_30 } = await knex('orders')
        .count<{ c_30: number }>({ c_30: '*' })
        .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]))
        .first();

      // revenue sums (use orders.total_price)
      const [{ r_today }] = await knex('orders')
        .sum<{ r_today: string | number }>({ r_today: 'total_price' })
        .whereRaw('DATE(created_at) = CURDATE()');

      const [{ r_7 }] = await knex('orders')
        .sum<{ r_7: string | number }>({ r_7: 'total_price' })
        .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL 7 DAY)'));

      const [{ r_30 }] = await knex('orders')
        .sum<{ r_30: string | number }>({ r_30: 'total_price' })
        .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]));

      ctx.body = {
        ordersToday: Number(c_today || 0),
        orders7d: Number(c_7 || 0),
        orders30d: Number(c_30 || 0),
        revenueToday: Number(r_today || 0),
        revenue7d: Number(r_7 || 0),
        revenue30d: Number(r_30 || 0),
      };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch KPIs', { details: error.message });
    }
  },

  async revenue(ctx) {
    try {
      const days = Math.min(Math.max(Number(ctx.request.query.range || 30), 1), 365);
      const knex = strapi.db.connection;

      const rows = await knex('orders')
        .select(knex.raw('DATE(created_at) AS day'))
        .sum({ revenue: 'total_price' })
        .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]))
        .groupBy('day')
        .orderBy('day', 'asc');

      // shape: [{ date, revenue }]
      ctx.body = rows.map((r: any) => ({
        date: r.day?.toISOString ? r.day.toISOString().slice(0, 10) : String(r.day),
        revenue: Number(r.revenue || 0),
      }));
    } catch (error) {
      ctx.throw(500, 'Failed to fetch revenue data', { details: error.message });
    }
  },

  async orderStatus(ctx) {
    try {
      const knex = strapi.db.connection;

      const rows = await knex('orders')
        .select('order_status')
        .count({ count: '*' })
        .groupBy('order_status');

      const total = rows.reduce((acc, r: any) => acc + Number(r.count || 0), 0) || 1;

      ctx.body = rows.map((r: any) => ({
        status: String(r.order_status),
        count: Number(r.count || 0),
        percentage: Math.round((Number(r.count || 0) * 100) / total),
      }));
    } catch (error) {
      ctx.throw(500, 'Failed to fetch order status data', { details: error.message });
    }
  },

  // optional combined endpoint if you prefer one call
  async summary(ctx) {
    try {
      const days = Math.min(Math.max(Number(ctx.request.query.range || 30), 1), 365);
      const knex = strapi.db.connection;

      // Fetch KPIs with null safety
      const todayCount = await knex('orders')
        .count('* as count')
        .whereRaw('DATE(created_at) = CURDATE()')
        .first();

      const week7Count = await knex('orders')
        .count('* as count')
        .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL 7 DAY)'))
        .first();

      const daysCount = await knex('orders')
        .count('* as count')
        .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]))
        .first();

      const todayRevenue = await knex('orders')
        .sum('total_price as total')
        .whereRaw('DATE(created_at) = CURDATE()')
        .first();

      const week7Revenue = await knex('orders')
        .sum('total_price as total')
        .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL 7 DAY)'))
        .first();

      const daysRevenue = await knex('orders')
        .sum('total_price as total')
        .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]))
        .first();

      const kpis = {
        ordersToday: Number(todayCount?.count || 0),
        orders7d: Number(week7Count?.count || 0),
        orders30d: Number(daysCount?.count || 0),
        revenueToday: Number(todayRevenue?.total || 0),
        revenue7d: Number(week7Revenue?.total || 0),
        revenue30d: Number(daysRevenue?.total || 0),
      };

      // Fetch revenue by day
      const revenueRows = await knex('orders')
        .select(knex.raw('DATE(created_at) AS day'))
        .sum('total_price as revenue')
        .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]))
        .groupBy(knex.raw('DATE(created_at)'))
        .orderBy('day', 'asc');

      const revenueByDay = revenueRows.map((r: any) => ({
        date: r.day?.toISOString ? r.day.toISOString().slice(0, 10) : String(r.day),
        revenue: Number(r.revenue || 0),
      }));

      // Fetch order status
      const statusRows = await knex('orders')
        .select('order_status')
        .count('* as count')
        .groupBy('order_status');

      const total = statusRows.reduce((acc, r: any) => acc + Number(r.count || 0), 0) || 1;

      const ordersByStatus = statusRows.map((r: any) => ({
        status: String(r.order_status || 'unknown'),
        count: Number(r.count || 0),
        percentage: Math.round((Number(r.count || 0) * 100) / total),
      }));

      ctx.body = { 
        kpis, 
        revenueByDay, 
        ordersByStatus 
      };
    } catch (error) {
      strapi.log.error('Analytics summary error:', error);
      ctx.throw(500, 'Failed to fetch analytics summary', { 
        details: error.message,
        stack: error.stack 
      });
    }
  },

  async topProducts(ctx) {
    try {
      const limit = Math.min(Math.max(Number(ctx.request.query.limit || 10), 1), 50);
      const days = Math.min(Math.max(Number(ctx.request.query.range || 30), 1), 365);
      const knex = strapi.db.connection;

      const rows = await knex('order_items')
        .join('products', 'order_items.product', '=', 'products.id')
        .join('orders', 'order_items.order', '=', 'orders.id')
        .select('products.id', 'products.name', 'products.sku')
        .sum({ totalQuantity: 'order_items.quantity' })
        .sum({ totalRevenue: knex.raw('order_items.quantity * order_items.unit_price') })
        .count({ orderCount: 'order_items.id' })
        .where('orders.created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]))
        .groupBy('products.id', 'products.name', 'products.sku')
        .orderBy('totalQuantity', 'desc')
        .limit(limit);

      ctx.body = rows.map((r: any) => ({
        productId: Number(r.id),
        name: String(r.name),
        sku: String(r.sku),
        totalQuantity: Number(r.totalQuantity || 0),
        totalRevenue: Number(r.totalRevenue || 0),
        orderCount: Number(r.orderCount || 0),
      }));
    } catch (error) {
      ctx.throw(500, 'Failed to fetch top products', { details: error.message });
    }
  },

  async lowStockProducts(ctx) {
    try {
      const threshold = Math.max(Number(ctx.request.query.threshold || 10), 0);
      const knex = strapi.db.connection;

      const rows = await knex('products')
        .select('id', 'name', 'sku', 'stock', 'price', 'is_active')
        .where('stock', '<=', threshold)
        .where('is_active', true)
        .orderBy('stock', 'asc');

      ctx.body = rows.map((r: any) => ({
        productId: Number(r.id),
        name: String(r.name),
        sku: String(r.sku),
        stock: Number(r.stock),
        price: Number(r.price),
        isActive: Boolean(r.is_active),
      }));
    } catch (error) {
      ctx.throw(500, 'Failed to fetch low stock products', { details: error.message });
    }
  },

  async inventoryValue(ctx) {
    try {
      const knex = strapi.db.connection;

      const [result] = await knex('products')
        .sum({ totalValue: knex.raw('stock * price') })
        .count({ totalProducts: 'id' })
        .sum({ totalStock: 'stock' })
        .where('is_active', true);

      const lowStockCount = await knex('products')
        .count({ count: 'id' })
        .where('stock', '<=', 10)
        .where('is_active', true)
        .first();

      const outOfStockCount = await knex('products')
        .count({ count: 'id' })
        .where('stock', '=', 0)
        .where('is_active', true)
        .first();

      ctx.body = {
        totalInventoryValue: Number(result.totalValue || 0),
        totalProducts: Number(result.totalProducts || 0),
        totalStock: Number(result.totalStock || 0),
        lowStockCount: Number(lowStockCount.count || 0),
        outOfStockCount: Number(outOfStockCount.count || 0),
      };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch inventory value', { details: error.message });
    }
  },
}));
