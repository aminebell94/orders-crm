import { errors } from '@strapi/utils';

const { ForbiddenError } = errors;

/**
 * Factory policy that checks if the authenticated user has one of the allowed roles.
 * Usage: { name: 'global::is-role', config: { roles: ['admin', 'manager'] } }
 *
 * Validates: Requirements 3.4, 4.4, 4.5
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;

  if (!user) {
    throw new ForbiddenError("You don't have permission to perform this action");
  }

  const allowedRoles: string[] = config?.roles ?? [];

  if (!allowedRoles.length) {
    throw new ForbiddenError("You don't have permission to perform this action");
  }

  // Fetch the user with their role populated
  const fullUser = await strapi
    .plugin('users-permissions')
    .service('user')
    .fetch(user.id, { populate: ['role'] });

  const roleType = fullUser?.role?.type;

  if (!roleType || !allowedRoles.includes(roleType)) {
    throw new ForbiddenError("You don't have permission to perform this action");
  }

  return true;
};
