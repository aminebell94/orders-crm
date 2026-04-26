/**
 * Admin User Management Controller
 *
 * Provides admin-only endpoints for user management:
 *   - listUsers: List all users with role info
 *   - changeRole: Change a user's role
 *   - deactivateUser: Deactivate a user account
 *   - resetPassword: Admin-initiated password reset
 *
 * All handlers assume `is-authenticated` and `is-admin` policies
 * are applied at the route level.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 3.3, 3.6
 */

import { errors } from '@strapi/utils';
import { logAuditEvent, AuditAction } from '../../../utils/audit-logger';
import { isValidPassword } from '../validation';

const { ValidationError, NotFoundError } = errors;

/**
 * GET /api/users — List all users with role info (Admin only)
 *
 * Validates: Requirements 6.1
 */
export function buildListUsers() {
  return async (ctx: any) => {
    const users = await strapi.db
      .query('plugin::users-permissions.user')
      .findMany({
        populate: ['role'],
      });

    ctx.status = 200;
    ctx.body = users.map((user: any) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      is_active: user.is_active,
      confirmed: user.confirmed,
      blocked: user.blocked,
      role: user.role
        ? { id: user.role.id, name: user.role.name, type: user.role.type }
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  };
}


/**
 * PUT /api/users/:id/role — Change user role (Admin only)
 *
 * Body: { role: string } — the role type (e.g. 'customer', 'manager', 'admin')
 *
 * Validates: Requirements 3.3, 3.6, 6.4, 6.5
 */
export function buildChangeRole() {
  return async (ctx: any) => {
    const targetUserId = Number(ctx.params.id);
    const { role: roleType } = ctx.request.body ?? {};
    const adminUser = ctx.state.user;
    const ip = ctx.request.ip;

    if (!roleType || typeof roleType !== 'string') {
      throw new ValidationError('Role type is required');
    }

    // Validate the target user exists
    const targetUser = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: targetUserId }, populate: ['role'] });

    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    // Validate the role exists
    const newRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: roleType } });

    if (!newRole) {
      throw new ValidationError(`Role '${roleType}' does not exist`);
    }

    // Prevent role escalation: only admins can assign admin role,
    // and the requesting user must already be an admin (enforced by is-admin policy).
    // Additional guard: prevent assigning a role that doesn't exist in the system.

    // Update the user's role
    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: targetUserId },
      data: { role: newRole.id },
    });

    // Log the role change
    logAuditEvent(strapi, {
      action: AuditAction.ROLE_CHANGE,
      actorId: adminUser.id,
      targetId: targetUserId,
      ip,
      metadata: {
        previousRole: targetUser.role?.type ?? null,
        newRole: roleType,
      },
    });

    ctx.status = 200;
    ctx.body = {
      message: `User role updated to '${roleType}'`,
      user: {
        id: targetUserId,
        role: { id: newRole.id, name: newRole.name, type: newRole.type },
      },
    };
  };
}

/**
 * PUT /api/users/:id/deactivate — Deactivate user (Admin only)
 *
 * Prevents self-deactivation.
 *
 * Validates: Requirements 6.2, 6.5, 6.6
 */
export function buildDeactivateUser() {
  return async (ctx: any) => {
    const targetUserId = Number(ctx.params.id);
    const adminUser = ctx.state.user;
    const ip = ctx.request.ip;

    // Prevent self-deactivation
    if (adminUser.id === targetUserId) {
      throw new ValidationError('Admins cannot deactivate their own account');
    }

    // Validate the target user exists
    const targetUser = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: targetUserId } });

    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    // Deactivate the user
    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: targetUserId },
      data: { is_active: false },
    });

    // Log the deactivation
    logAuditEvent(strapi, {
      action: AuditAction.ACCOUNT_DEACTIVATION,
      actorId: adminUser.id,
      targetId: targetUserId,
      ip,
      metadata: { username: targetUser.username, email: targetUser.email },
    });

    ctx.status = 200;
    ctx.body = {
      message: 'User account deactivated',
      user: { id: targetUserId, is_active: false },
    };
  };
}

/**
 * PUT /api/users/:id/reset-password — Admin reset user password (Admin only)
 *
 * Body: { password: string }
 *
 * Validates: Requirements 6.3, 6.5
 */
export function buildResetPassword() {
  return async (ctx: any) => {
    const targetUserId = Number(ctx.params.id);
    const { password } = ctx.request.body ?? {};
    const adminUser = ctx.state.user;
    const ip = ctx.request.ip;

    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required');
    }

    // Validate password complexity
    if (!isValidPassword(password)) {
      throw new ValidationError(
        'Password must be at least 8 characters with mixed case and numbers',
      );
    }

    // Validate the target user exists
    const targetUser = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: targetUserId } });

    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    // Hash the new password
    const hashedPassword = await strapi
      .plugin('users-permissions')
      .service('user')
      .hashPassword(password);

    // Update the user's password
    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: targetUserId },
      data: { password: hashedPassword },
    });

    // Log the password reset
    logAuditEvent(strapi, {
      action: AuditAction.PASSWORD_RESET,
      actorId: adminUser.id,
      targetId: targetUserId,
      ip,
      metadata: { username: targetUser.username, email: targetUser.email },
    });

    ctx.status = 200;
    ctx.body = {
      message: 'User password has been reset',
      user: { id: targetUserId },
    };
  };
}
