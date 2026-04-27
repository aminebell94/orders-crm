export default {
  routes: [
    {
      method: 'GET',
      path: '/analytic/kpis',
      handler: 'analytic.kpis',
      config: { policies: ['global::is-authenticated', { name: 'global::is-role', config: { roles: ['admin', 'manager'] } }], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/revenue',
      handler: 'analytic.revenue',
      config: { policies: ['global::is-authenticated', { name: 'global::is-role', config: { roles: ['admin', 'manager'] } }], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/order-status',
      handler: 'analytic.orderStatus',
      config: { policies: ['global::is-authenticated', { name: 'global::is-role', config: { roles: ['admin', 'manager'] } }], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/summary',
      handler: 'analytic.summary',
      config: { policies: ['global::is-authenticated', { name: 'global::is-role', config: { roles: ['admin', 'manager'] } }], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/top-products',
      handler: 'analytic.topProducts',
      config: { policies: ['global::is-authenticated', { name: 'global::is-role', config: { roles: ['admin', 'manager'] } }], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/low-stock',
      handler: 'analytic.lowStockProducts',
      config: { policies: ['global::is-authenticated', { name: 'global::is-role', config: { roles: ['admin', 'manager'] } }], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/analytic/inventory-value',
      handler: 'analytic.inventoryValue',
      config: { policies: ['global::is-authenticated', { name: 'global::is-role', config: { roles: ['admin', 'manager'] } }], middlewares: [] },
    },
  ],
};
