/**
 * Extended Auth Controller
 *
 * Wraps the default users-permissions auth callback to enforce:
 *   - is_active check (401 if deactivated)
 *   - locked_until check (429 if locked)
 *   - Increment failed_login_attempts on failure
 *   - Reset failed_login_attempts on success
 *   - Audit logging for login success/failure
 *
 * Validates: Requirements 1.2, 1.3, 6.2, 7.2, 7.6
 */

import { logAuditEvent, AuditAction } from '../../../utils/audit-logger';

/**
 * Look up a user by their login identifier (email or username).
 * Returns the user with the custom auth fields or null.
 */
async function findUserByIdentifier(
  strapi: any,
  identifier: string,
): Promise<any | null> {
  if (!identifier) return null;

  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: {
      $or: [
        { email: identifier.toLowerCase().trim() },
        { username: identifier.trim() },
      ],
    },
    populate: ['role'],
  });

  return user ?? null;
}

/**
 * Build the custom auth callback that wraps the original plugin callback.
 */
export function buildAuthCallback(originalCallback: (...args: any[]) => any) {
  return async (ctx: any) => {
    const { identifier } = ctx.request.body ?? {};
    const ip = ctx.request.ip;

    // --- Pre-login checks ---
    if (identifier) {
      const user = await findUserByIdentifier(strapi, identifier);

      if (user) {
        // Check if account is deactivated
        if (user.is_active === false) {
          logAuditEvent(strapi, {
            action: AuditAction.LOGIN_FAILURE,
            actorId: user.id,
            targetId: user.id,
            ip,
            metadata: { reason: 'account_deactivated', identifier },
          });

          ctx.status = 401;
          ctx.body = {
            error: {
              status: 401,
              name: 'UnauthorizedError',
              message: 'Account is deactivated',
            },
          };
          return;
        }

        // Check if account is temporarily locked
        if (user.locked_until) {
          const lockedUntil = new Date(user.locked_until);
          if (lockedUntil > new Date()) {
            logAuditEvent(strapi, {
              action: AuditAction.LOGIN_FAILURE,
              actorId: user.id,
              targetId: user.id,
              ip,
              metadata: { reason: 'account_locked', identifier, locked_until: user.locked_until },
            });

            const retryAfterSeconds = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
            ctx.set('Retry-After', String(retryAfterSeconds));
            ctx.status = 429;
            ctx.body = {
              error: {
                status: 429,
                name: 'TooManyRequestsError',
                message: 'Account temporarily locked. Try again later.',
              },
            };
            return;
          }
        }
      }
    }

    // --- Call the original auth callback ---
    await originalCallback(ctx);

    // --- Post-login handling ---
    if (!identifier) return;

    const user = await findUserByIdentifier(strapi, identifier);
    if (!user) return;

    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS ?? '5', 10);
    const lockDurationMinutes = parseInt(process.env.ACCOUNT_LOCK_DURATION ?? '15', 10);

    if (ctx.status === 200 && ctx.body?.jwt) {
      // Successful login — reset failed attempts
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: {
          failed_login_attempts: 0,
          locked_until: null,
        },
      });

      logAuditEvent(strapi, {
        action: AuditAction.LOGIN_SUCCESS,
        actorId: user.id,
        targetId: user.id,
        ip,
        metadata: { identifier },
      });
    } else if (ctx.status === 400) {
      // Failed login — increment failed attempts
      const newCount = (user.failed_login_attempts ?? 0) + 1;
      const updateData: Record<string, any> = {
        failed_login_attempts: newCount,
      };

      // Lock the account if threshold reached
      if (newCount >= maxAttempts) {
        const lockUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
        updateData.locked_until = lockUntil.toISOString();
      }

      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: updateData,
      });

      logAuditEvent(strapi, {
        action: AuditAction.LOGIN_FAILURE,
        actorId: user.id,
        targetId: user.id,
        ip,
        metadata: {
          identifier,
          failed_attempts: newCount,
          locked: newCount >= maxAttempts,
        },
      });
    }
  };
}
