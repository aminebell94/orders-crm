import { factories } from '@strapi/strapi';

const authPolicies = [
  'global::is-authenticated',
  { name: 'global::is-role', config: { roles: ['manager', 'admin'] } },
];

export default factories.createCoreRouter('api::order-item.order-item', {
  config: {
    find: { policies: authPolicies },
    findOne: { policies: authPolicies },
    create: { policies: authPolicies },
    update: { policies: authPolicies },
    delete: { policies: authPolicies },
  },
});
