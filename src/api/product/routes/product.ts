import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::product.product', {
  config: {
    find: {
      policies: [],
    },
    findOne: {
      policies: [],
    },
    create: {
      policies: [
        'global::is-authenticated',
        { name: 'global::is-role', config: { roles: ['manager', 'admin'] } },
      ],
    },
    update: {
      policies: [
        'global::is-authenticated',
        { name: 'global::is-role', config: { roles: ['manager', 'admin'] } },
      ],
    },
    delete: {
      policies: [
        'global::is-authenticated',
        { name: 'global::is-role', config: { roles: ['manager', 'admin'] } },
      ],
    },
  },
});
