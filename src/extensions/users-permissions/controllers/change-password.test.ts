import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildChangePassword } from './change-password';

// Mock the global strapi object
const mockStrapi = {
  db: {
    query: vi.fn(),
  },
  plugin: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
};

// Assign to global so the controller can access it
(globalThis as any).strapi = mockStrapi;

function createMockCtx(overrides: Record<string, any> = {}) {
  return {
    state: { user: { id: 1 } },
    request: {
      body: { currentPassword: 'OldPass1', newPassword: 'NewPass1' },
      ip: '127.0.0.1',
    },
    status: 200,
    body: null as any,
    ...overrides,
  };
}

describe('changePassword controller', () => {
  const handler = buildChangePassword();
  const hashedOldPassword = bcrypt.hashSync('OldPass1', 10);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: findOne returns user with hashed password
    mockStrapi.db.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue({
        id: 1,
        password: hashedOldPassword,
      }),
      update: vi.fn().mockResolvedValue({}),
    });

    // Default: hashPassword service
    mockStrapi.plugin.mockReturnValue({
      service: () => ({
        hashPassword: vi.fn().mockResolvedValue('new-hashed-password'),
      }),
    });
  });

  it('should change password when current password is correct', async () => {
    const ctx = createMockCtx();
    await handler(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({ message: 'Password changed successfully' });
  });

  it('should return 400 when currentPassword is missing', async () => {
    const ctx = createMockCtx({
      request: { body: { newPassword: 'NewPass1' }, ip: '127.0.0.1' },
    });
    await handler(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body.error.message).toBe(
      'Both currentPassword and newPassword are required',
    );
  });

  it('should return 400 when newPassword is missing', async () => {
    const ctx = createMockCtx({
      request: { body: { currentPassword: 'OldPass1' }, ip: '127.0.0.1' },
    });
    await handler(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body.error.message).toBe(
      'Both currentPassword and newPassword are required',
    );
  });

  it('should return 400 when new password fails complexity check', async () => {
    const ctx = createMockCtx({
      request: {
        body: { currentPassword: 'OldPass1', newPassword: 'weak' },
        ip: '127.0.0.1',
      },
    });
    await handler(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body.error.message).toBe(
      'Password must be at least 8 characters with mixed case and numbers',
    );
  });

  it('should return 400 when current password is incorrect', async () => {
    const ctx = createMockCtx({
      request: {
        body: { currentPassword: 'WrongPass1', newPassword: 'NewPass1' },
        ip: '127.0.0.1',
      },
    });
    await handler(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body.error.message).toBe('Current password is incorrect');
  });

  it('should return 401 when user is not authenticated', async () => {
    const ctx = createMockCtx({ state: { user: null } });
    await handler(ctx);

    expect(ctx.status).toBe(401);
    expect(ctx.body.error.name).toBe('UnauthorizedError');
  });

  it('should hash the new password before storing', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({});
    mockStrapi.db.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue({
        id: 1,
        password: hashedOldPassword,
      }),
      update: mockUpdate,
    });

    const ctx = createMockCtx();
    await handler(ctx);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { password: 'new-hashed-password' },
    });
  });

  it('should return 401 when user record is not found in database', async () => {
    mockStrapi.db.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    });

    const ctx = createMockCtx();
    await handler(ctx);

    expect(ctx.status).toBe(401);
    expect(ctx.body.error.name).toBe('UnauthorizedError');
  });
});
