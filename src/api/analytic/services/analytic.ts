import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::analytic.analytic', ({ strapi }) => ({
  async getKpis(ctx) {
    const days = Math.min(Math.max(Number(ctx.request.query.range || 30), 1), 365);
    const knex = strapi.db.connection;

    const [{ c_today }] = await knex('orders')
      .count<[{ c_today: number }]>({ c_today: '*' })
      .whereRaw('DATE(created_at) = CURDATE()');

    const [{ c_7 }] = await knex('orders')
      .count<[{ c_7: number }]>({ c_7: '*' })
      .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL 7 DAY)'));

    const [{ c_30 }] = await knex('orders')
      .count<[{ c_30: number }]>({ c_30: '*' })
      .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]));

    const [{ r_today }] = await knex('orders')
      .sum<{ r_today: string | number }>({ r_today: 'total_price' })
      .whereRaw('DATE(created_at) = CURDATE()');

    const [{ r_7 }] = await knex('orders')
      .sum<{ r_7: string | number }>({ r_7: 'total_price' })
      .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL 7 DAY)'));

    const [{ r_30 }] = await knex('orders')
      .sum<{ r_30: string | number }>({ r_30: 'total_price' })
      .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]));

    return {
      ordersToday: Number(c_today || 0),
      orders7d: Number(c_7 || 0),
      orders30d: Number(c_30 || 0),
      revenueToday: Number(r_today || 0),
      revenue7d: Number(r_7 || 0),
      revenue30d: Number(r_30 || 0),
    };
  },

  async getRevenue(ctx) {
    const days = Math.min(Math.max(Number(ctx.request.query.range || 30), 1), 365);
    const knex = strapi.db.connection;

    const rows = await knex('orders')
      .select(knex.raw('DATE(created_at) AS day'))
      .sum({ revenue: 'total_price' })
      .where('created_at', '>=', knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days]))
      .groupBy('day')
      .orderBy('day', 'asc');

    return rows.map((r: any) => ({
      date: r.day?.toISOString ? r.day.toISOString().slice(0, 10) : String(r.day),
      revenue: Number(r.revenue || 0),
    }));
  },

  async getOrderStatus(ctx) {
    const knex = strapi.db.connection;
    const rows = await knex('orders')
      .select('order_status')
      .count({ count: '*' })
      .groupBy('order_status');

    const total = rows.reduce((acc, r: any) => acc + Number(r.count || 0), 0) || 1;

    return rows.map((r: any) => ({
      status: String(r.order_status),
      count: Number(r.count || 0),
      percentage: Math.round((Number(r.count || 0) * 100) / total),
    }));
  },
}));
