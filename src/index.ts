import type { Core } from '@strapi/strapi';

/**
 * Permission definitions per role based on the RBAC matrix.
 *
 * | Role     | Orders          | Products   | Analytics | Users       |
 * |----------|-----------------|------------|-----------|-------------|
 * | Customer | Own only (CRUD) | Read only  | None      | Own profile |
 * | Manager  | All (CRUD)      | All (CRUD) | None      | None        |
 * | Admin    | All (CRUD)      | All (CRUD) | All (Read) | All (CRUD) |
 */

interface RoleDefinition {
  name: string;
  description: string;
  type: string;
  permissions: Record<string, { actions: string[] }>;
}

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: 'Customer',
    description: 'Default role for registered users. Can manage own orders and view products.',
    type: 'customer',
    permissions: {
      'api::order.order': {
        actions: ['find', 'findOne', 'create', 'update'],
      },
      'api::product.product': {
        actions: ['find', 'findOne'],
      },
    },
  },
  {
    name: 'Manager',
    description: 'Can manage all orders, products, and order items.',
    type: 'manager',
    permissions: {
      'api::order.order': {
        actions: ['find', 'findOne', 'create', 'update', 'delete'],
      },
      'api::product.product': {
        actions: ['find', 'findOne', 'create', 'update', 'delete'],
      },
      'api::order-item.order-item': {
        actions: ['find', 'findOne', 'create', 'update', 'delete'],
      },
    },
  },
  {
    name: 'Admin',
    description: 'Full system access including analytics and user management.',
    type: 'admin',
    permissions: {
      'api::order.order': {
        actions: ['find', 'findOne', 'create', 'update', 'delete'],
      },
      'api::product.product': {
        actions: ['find', 'findOne', 'create', 'update', 'delete'],
      },
      'api::order-item.order-item': {
        actions: ['find', 'findOne', 'create', 'update', 'delete'],
      },
    },
  },
];

/**
 * Build the permissions array for a role from its definition.
 * Each permission is an object with an `action` string in the format:
 *   `api::content-type.content-type.actionName`
 */
function buildPermissions(
  roleDef: RoleDefinition
): { action: string }[] {
  const permissions: { action: string }[] = [];

  for (const [contentTypeUid, config] of Object.entries(roleDef.permissions)) {
    for (const action of config.actions) {
      permissions.push({ action: `${contentTypeUid}.${action}` });
    }
  }

  return permissions;
}

/**
 * Create a role with its permissions if it doesn't already exist.
 * Returns the role (existing or newly created).
 */
async function ensureRole(
  strapi: Core.Strapi,
  roleDef: RoleDefinition
): Promise<any> {
  // Query roles directly via the database layer to avoid plugin service quirks
  const existingRole = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: roleDef.type },
  });

  if (existingRole) {
    strapi.log.info(`Role "${roleDef.name}" (type: ${roleDef.type}) already exists.`);
    return existingRole;
  }

  // Create the role
  const newRole = await strapi.db.query('plugin::users-permissions.role').create({
    data: {
      name: roleDef.name,
      description: roleDef.description,
      type: roleDef.type,
    },
  });

  // Create permissions for the role
  const permissions = buildPermissions(roleDef);
  for (const perm of permissions) {
    await strapi.db.query('plugin::users-permissions.permission').create({
      data: {
        action: perm.action,
        role: newRole.id,
      },
    });
  }

  strapi.log.info(`Created role "${roleDef.name}" (type: ${roleDef.type}) with ${permissions.length} permissions.`);
  return newRole;
}

/**
 * Set the default registration role to Customer.
 */
async function setDefaultRegistrationRole(strapi: Core.Strapi): Promise<void> {
  const customerRole = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'customer' },
  });

  if (!customerRole) {
    strapi.log.warn('Customer role not found — cannot set as default registration role.');
    return;
  }

  const pluginStore = strapi.store({
    type: 'plugin',
    name: 'users-permissions',
  });

  const advancedSettings: any = await pluginStore.get({ key: 'advanced' });

  if (advancedSettings?.default_role !== customerRole.id) {
    await pluginStore.set({
      key: 'advanced',
      value: {
        ...advancedSettings,
        default_role: customerRole.id,
      },
    });
    strapi.log.info(`Default registration role set to "Customer" (id: ${customerRole.id}).`);
  } else {
    strapi.log.info('Default registration role is already set to "Customer".');
  }
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * Creates default roles (Customer, Manager, Admin) with RBAC permissions
   * and sets Customer as the default registration role.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Create all default roles with their permissions
    for (const roleDef of ROLE_DEFINITIONS) {
      await ensureRole(strapi, roleDef);
    }

    // Set Customer as the default role for new registrations
    await setDefaultRegistrationRole(strapi);
  },
};
