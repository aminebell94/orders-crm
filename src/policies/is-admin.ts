import { errors } from '@strapi/utils';

const { ForbiddenError } = errors;

/**
 * Shorthand policy that checks for the Admin role specifically.
 * Usage: 'global::is-admin'
 *
 * Validates: Requirements 4.5, 6.1
 */
export default async (policyContext, _config, { strapi }) => {
  const user = policyContext.state?.user;

  if (!user) {
    throw new ForbiddenError("You don't have permission to perform this action");
  }

  const fullUser = await strapi
    .plugin('users-permissions')
    .service('user')
    .fetch(user.id, { populate: ['role'] });

  const roleType = fullUser?.role?.type;

  if (roleType !== 'admin') {
    throw new ForbiddenError("You don't have permission to perform this action");
  }

  return true;
};
