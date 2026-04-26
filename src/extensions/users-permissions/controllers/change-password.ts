/**
 * Change Password Controller
 *
 * Handles password change requests for authenticated users.
 * Requires current password verification before allowing the change.
 * Encrypts the new password before storage and logs the event via audit logger.
 *
 * Validates: Requirements 5.3, 5.4
 */

import bcrypt from 'bcryptjs';
import { logAuditEvent, AuditAction } from '../../../utils/audit-logger';
import { isValidPassword } from '../validation';

/**
 * Build the changePassword handler for the auth controller.
 */
export function buildChangePassword() {
  return async (ctx: any) => {
    const { currentPassword, newPassword } = ctx.request.body ?? {};
    const user = ctx.state.user;

    // Ensure the user is authenticated (should be guaranteed by is-authenticated policy)
    if (!user) {
      ctx.status = 401;
      ctx.body = {
        error: {
          status: 401,
          name: 'UnauthorizedError',
          message: 'Missing or invalid credentials',
        },
      };
      return;
    }

    // Validate required fields
    if (!currentPassword || !newPassword) {
      ctx.status = 400;
      ctx.body = {
        error: {
          status: 400,
          name: 'ValidationError',
          message: 'Both currentPassword and newPassword are required',
        },
      };
      return;
    }

    // Validate new password complexity
    if (!isValidPassword(newPassword)) {
      ctx.status = 400;
      ctx.body = {
        error: {
          status: 400,
          name: 'ValidationError',
          message:
            'Password must be at least 8 characters with mixed case and numbers',
        },
      };
      return;
    }

    // Fetch the full user record with password hash
    const fullUser = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: user.id } });

    if (!fullUser) {
      ctx.status = 401;
      ctx.body = {
        error: {
          status: 401,
          name: 'UnauthorizedError',
          message: 'Missing or invalid credentials',
        },
      };
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, fullUser.password);

    if (!isValid) {
      ctx.status = 400;
      ctx.body = {
        error: {
          status: 400,
          name: 'ValidationError',
          message: 'Current password is incorrect',
        },
      };
      return;
    }

    // Hash the new password using the users-permissions plugin service
    const hashedPassword = await strapi
      .plugin('users-permissions')
      .service('user')
      .hashPassword(newPassword);

    // Update the user's password
    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Log the password change
    logAuditEvent(strapi, {
      action: AuditAction.PASSWORD_CHANGE,
      actorId: user.id,
      targetId: user.id,
      ip: ctx.request.ip,
    });

    ctx.status = 200;
    ctx.body = { message: 'Password changed successfully' };
  };
}
