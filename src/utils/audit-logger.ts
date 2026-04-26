/**
 * Audit Logger Utility
 *
 * Logs security-relevant events via strapi.log with structured metadata.
 * Used across auth controllers, policies, and admin endpoints.
 *
 * Validates: Requirements 6.5, 7.6
 */

export const AuditAction = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  ROLE_CHANGE: 'ROLE_CHANGE',
  ACCOUNT_DEACTIVATION: 'ACCOUNT_DEACTIVATION',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEvent {
  action: AuditActionType;
  actorId?: number | string | null;
  targetId?: number | string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}

/** Actions that indicate a security warning rather than informational event */
const WARN_ACTIONS: ReadonlySet<AuditActionType> = new Set([
  AuditAction.LOGIN_FAILURE,
  AuditAction.UNAUTHORIZED_ACCESS,
  AuditAction.ACCOUNT_DEACTIVATION,
]);

/**
 * Log a security audit event through Strapi's built-in logger.
 *
 * @param strapi - The Strapi instance (provides `strapi.log`)
 * @param event  - Structured audit event details
 */
export function logAuditEvent(
  strapi: { log: { info: (msg: string) => void; warn: (msg: string) => void } },
  event: AuditEvent,
): void {
  const entry = {
    audit: true,
    action: event.action,
    actorId: event.actorId ?? null,
    targetId: event.targetId ?? null,
    timestamp: new Date().toISOString(),
    ip: event.ip ?? null,
    ...(event.metadata ? { metadata: event.metadata } : {}),
  };

  const message = `[AUDIT] ${event.action} ${JSON.stringify(entry)}`;

  if (WARN_ACTIONS.has(event.action)) {
    strapi.log.warn(message);
  } else {
    strapi.log.info(message);
  }
}
