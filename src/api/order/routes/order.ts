import { factories } from '@strapi/strapi';

/**
 * Custom core router for orders with authentication and authorization policies.
 *
 * - All order endpoints require authentication
 * - findOne, update: require is-owner (customers see only their own orders; managers/admins bypass)
 * - delete: restricted to managers and admins only
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 8.1
 */
export default factories.createCoreRouter('api::order.order', {
  config: {
    find: {
      policies: ['global::is-authenticated'],
    },
    findOne: {
      policies: ['global::is-authenticated', 'global::is-owner'],
    },
    create: {
      policies: ['global::is-authenticated'],
    },
    update: {
      policies: ['global::is-authenticated', 'global::is-owner'],
    },
    delete: {
      policies: [
        'global::is-authenticated',
        { name: 'global::is-role', config: { roles: ['manager', 'admin'] } },
      ],
    },
  },
});
