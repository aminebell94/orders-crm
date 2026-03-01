export default {
  routes: [
    {
      method: 'GET',
      path: '/analytic/kpis',
      handler: 'analytic.kpis',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/revenue',
      handler: 'analytic.revenue',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/order-status',
      handler: 'analytic.orderStatus',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/summary',
      handler: 'analytic.summary',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/top-products',
      handler: 'analytic.topProducts',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/low-stock',
      handler: 'analytic.lowStockProducts',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/inventory-value',
      handler: 'analytic.inventoryValue',
      config: { policies: [], middlewares: [] },
    },
  ],
};
