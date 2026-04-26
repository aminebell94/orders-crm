/**
 * Users-Permissions Plugin Extension
 *
 * Extends the default users-permissions plugin by overriding:
 *   - auth.callback: custom pre/post login logic (is_active, lock, failed attempts)
 *   - auth.register: input validation for email format and password complexity
 *   - auth.changePassword: password change with current password verification
 *
 * In Strapi 5, plugin extensions export a function that receives the
 * plugin object and returns the modified plugin.
 */

import { buildAuthCallback } from './controllers/auth';
import { buildChangePassword } from './controllers/change-password';
import {
  buildListUsers,
  buildChangeRole,
  buildDeactivateUser,
  buildResetPassword,
} from './controllers/admin';
import { validateRegistrationInput } from './validation';

export default (plugin: any) => {
  const originalCallback = plugin.controllers.auth.callback;
  const originalRegister = plugin.controllers.auth.register;

  // Override the auth callback with our extended version
  plugin.controllers.auth.callback = buildAuthCallback(originalCallback);

  // Override the register method with validation
  plugin.controllers.auth.register = async (ctx: any) => {
    const body = ctx.request.body ?? {};
    const errors = validateRegistrationInput(body);

    if (errors.length > 0) {
      ctx.status = 400;
      ctx.body = {
        error: {
          status: 400,
          name: 'ValidationError',
          message: errors[0],
          details: { errors },
        },
      };
      return;
    }

    // Validation passed — delegate to the original register handler
    return originalRegister(ctx);
  };

  // Add password change endpoint
  plugin.controllers.auth.changePassword = buildChangePassword();

  // --- Admin user management methods on the user controller ---
  plugin.controllers.user.listUsers = buildListUsers();
  plugin.controllers.user.changeRole = buildChangeRole();
  plugin.controllers.user.deactivateUser = buildDeactivateUser();
  plugin.controllers.user.resetPassword = buildResetPassword();

  // Register custom routes
  plugin.routes['content-api'].routes.push(
    // Password change
    {
      method: 'POST',
      path: '/auth/change-password',
      handler: 'auth.changePassword',
      config: {
        policies: ['global::is-authenticated'],
        prefix: '',
      },
    },
    // Admin: List all users
    {
      method: 'GET',
      path: '/users',
      handler: 'user.listUsers',
      config: {
        policies: ['global::is-authenticated', 'global::is-admin'],
        prefix: '',
      },
    },
    // Admin: Change user role
    {
      method: 'PUT',
      path: '/users/:id/role',
      handler: 'user.changeRole',
      config: {
        policies: ['global::is-authenticated', 'global::is-admin'],
        prefix: '',
      },
    },
    // Admin: Deactivate user
    {
      method: 'PUT',
      path: '/users/:id/deactivate',
      handler: 'user.deactivateUser',
      config: {
        policies: ['global::is-authenticated', 'global::is-admin'],
        prefix: '',
      },
    },
    // Admin: Reset user password
    {
      method: 'PUT',
      path: '/users/:id/reset-password',
      handler: 'user.resetPassword',
      config: {
        policies: ['global::is-authenticated', 'global::is-admin'],
        prefix: '',
      },
    },
  );

  return plugin;
};
