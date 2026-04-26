import { errors } from '@strapi/utils';

const { ForbiddenError } = errors;

/**
 * Policy that verifies the authenticated user owns the requested resource.
 * Managers and Admins bypass the ownership check.
 *
 * Usage: { name: 'global::is-owner', config: { contentType: 'api::order.order' } }
 * If no contentType is provided, defaults to 'api::order.order'.
 *
 * Validates: Requirements 4.2, 4.3
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;

  if (!user) {
    throw new ForbiddenError("You don't have permission to perform this action");
  }

  // Fetch the user with their role populated
  const fullUser = await strapi
    .plugin('users-permissions')
    .service('user')
    .fetch(user.id, { populate: ['role'] });

  const roleType = fullUser?.role?.type;

  // Managers and Admins bypass the ownership check
  if (roleType === 'manager' || roleType === 'admin') {
    return true;
  }

  // For customers, verify they own the resource
  const resourceId = policyContext.params?.id;

  if (!resourceId) {
    // No resource ID in the request (e.g., list endpoints) — allow through;
    // list filtering should be handled at the controller/service level
    return true;
  }

  const contentType = config?.contentType ?? 'api::order.order';

  const resource = await strapi.documents(contentType).findOne({
    documentId: resourceId,
    populate: ['user'],
  });

  if (!resource) {
    throw new ForbiddenError("You can only access your own resources");
  }

  // Check if the resource's user matches the authenticated user
  const resourceUserId = resource.user?.id;

  if (!resourceUserId || resourceUserId !== user.id) {
    throw new ForbiddenError("You can only access your own resources");
  }

  return true;
};
