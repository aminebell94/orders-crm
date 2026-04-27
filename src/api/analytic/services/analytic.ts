import { factories } from '@strapi/strapi';

function getDateHelpers(knex: any) {
  const client = knex.client?.config?.client || 'postgres';
  const isMySQL = client === 'mysql' || client === 'mysql2';

  return {
    todayWhere: (col: string) =>
      isMySQL ? knex.raw(`DATE(${col}) = CURDATE()`) : knex.raw(`${col}::date = CURRENT_DATE`),
    daysAgo: (days: number) =>
      isMySQL
        ? knex.raw('DATE_SUB(CURDATE(), INTERVAL ? DAY)', [days])
        : knex.raw(`CURRENT_DATE - INTERVAL '${days} days'`),
    dateCol: (col: string) =>
      isMySQL ? knex.raw(`DATE(${col})`) : knex.raw(`${col}::date`),
  };
}

export default factories.createCoreService('api::analytic.analytic', ({ strapi }) => ({
  async getKpis(ctx) {
    const days = Math.min(Math.max(Number(ctx.request.query.range || 30), 1), 365);
    const knex = strapi.db.connection;
    const d = getDateHelpers(knex);

    const [{ c_today }] = await knex('orders').count({ c_today: '*' }).whereRaw(d.todayWhere('created_at'));
    const [{ c_7 }] = await knex('orders').count({ c_7: '*' }).where('created_at', '>=', d.daysAgo(7));
    const [{ c_30 }] = await knex('orders').count({ c_30: '*' }).where('created_at', '>=', d.daysAgo(days));
    const [{ r_today }] = await knex('orders').sum({ r_today: 'total_price' }).whereRaw(d.todayWhere('created_at'));
    const [{ r_7 }] = await knex('orders').sum({ r_7: 'total_price' }).where('created_at', '>=', d.daysAgo(7));
    const [{ r_30 }] = await knex('orders').sum({ r_30: 'total_price' }).where('created_at', '>=', d.daysAgo(days));

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
    const d = getDateHelpers(knex);

    const rows = await knex('orders')
      .select(knex.raw('created_at::date AS day'))
      .sum({ revenue: 'total_price' })
      .where('created_at', '>=', d.daysAgo(days))
      .groupByRaw('created_at::date')
      .orderBy('day', 'asc');

    return rows.map((r: any) => ({
      date: r.day?.toISOString ? r.day.toISOString().slice(0, 10) : String(r.day),
      revenue: Number(r.revenue || 0),
    }));
  },

  async getOrderStatus(ctx) {
    const knex = strapi.db.connection;
    const rows = await knex('orders').select('order_status').count({ count: '*' }).groupBy('order_status');
    const total = rows.reduce((acc, r: any) => acc + Number(r.count || 0), 0) || 1;

    return rows.map((r: any) => ({
      status: String(r.order_status),
      count: Number(r.count || 0),
      percentage: Math.round((Number(r.count || 0) * 100) / total),
    }));
  },
}));
