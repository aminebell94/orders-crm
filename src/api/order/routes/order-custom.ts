/**
 * Custom order routes with authentication and authorization policies.
 *
 * - place: any authenticated user can place an order
 * - replace / replaceByDocumentId: restricted to managers and admins
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 8.1
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/orders/place',
      handler: 'order.place',
      config: {
        policies: ['global::is-authenticated'],
      },
    },
    {
      method: 'PUT',
      path: '/orders/:id/replace',
      handler: 'order.replace',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::is-role', config: { roles: ['manager', 'admin'] } },
        ],
      },
    },
    {
      method: 'PUT',
      path: '/orders/by-document/:documentId/replace',
      handler: 'order.replaceByDocumentId',
      config: {
        policies: [
          'global::is-authenticated',
          { name: 'global::is-role', config: { roles: ['manager', 'admin'] } },
        ],
      },
    },
  ],
};
