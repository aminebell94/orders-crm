/**
 * Unit tests for admin user management controller
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 3.3, 3.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildListUsers,
  buildChangeRole,
  buildDeactivateUser,
  buildResetPassword,
} from './admin';

// Mock the global strapi object used by the controllers
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

(globalThis as any).strapi = mockStrapi;

function createMockCtx(overrides: Record<string, any> = {}) {
  return {
    params: overrides.params ?? {},
    request: {
      body: overrides.body ?? {},
      ip: '127.0.0.1',
    },
    state: {
      user: overrides.user ?? { id: 1 },
    },
    status: 200,
    body: null as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildListUsers', () => {
  it('returns all users with role info', async () => {
    const handler = buildListUsers();
    const users = [
      {
        id: 1, username: 'admin', email: 'admin@test.com',
        is_active: true, confirmed: true, blocked: false,
        role: { id: 1, name: 'Admin', type: 'admin' },
        createdAt: '2024-01-01', updatedAt: '2024-01-01',
      },
      {
        id: 2, username: 'customer', email: 'cust@test.com',
        is_active: true, confirmed: true, blocked: false,
        role: { id: 2, name: 'Customer', type: 'customer' },
        createdAt: '2024-01-02', updatedAt: '2024-01-02',
      },
    ];

    mockStrapi.db.query.mockReturnValue({ findMany: vi.fn().mockResolvedValue(users) });

    const ctx = createMockCtx();
    await handler(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toHaveLength(2);
    expect(ctx.body[0].role.type).toBe('admin');
    expect(ctx.body[1].role.type).toBe('customer');
    // Ensure password is not leaked
    expect(ctx.body[0]).not.toHaveProperty('password');
  });

  it('handles users with no role', async () => {
    const handler = buildListUsers();
    const users = [
      {
        id: 1, username: 'norole', email: 'norole@test.com',
        is_active: true, confirmed: false, blocked: false,
        role: null,
        createdAt: '2024-01-01', updatedAt: '2024-01-01',
      },
    ];

    mockStrapi.db.query.mockReturnValue({ findMany: vi.fn().mockResolvedValue(users) });

    const ctx = createMockCtx();
    await handler(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.body[0].role).toBeNull();
  });
});


describe('buildChangeRole', () => {
  it('changes user role successfully', async () => {
    const handler = buildChangeRole();
    const targetUser = { id: 2, username: 'user', role: { type: 'customer' } };
    const newRole = { id: 3, name: 'Manager', type: 'manager' };

    mockStrapi.db.query.mockImplementation((model: string) => {
      if (model === 'plugin::users-permissions.user') {
        return {
          findOne: vi.fn().mockResolvedValue(targetUser),
          update: vi.fn().mockResolvedValue({}),
        };
      }
      if (model === 'plugin::users-permissions.role') {
        return { findOne: vi.fn().mockResolvedValue(newRole) };
      }
      return {};
    });

    const ctx = createMockCtx({
      params: { id: '2' },
      body: { role: 'manager' },
      user: { id: 1 },
    });

    await handler(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.body.message).toContain('manager');
    expect(ctx.body.user.role.type).toBe('manager');
  });

  it('rejects when role type is missing', async () => {
    const handler = buildChangeRole();
    const ctx = createMockCtx({ params: { id: '2' }, body: {} });

    await expect(handler(ctx)).rejects.toThrow('Role type is required');
  });

  it('rejects when target user does not exist', async () => {
    const handler = buildChangeRole();

    mockStrapi.db.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const ctx = createMockCtx({
      params: { id: '999' },
      body: { role: 'manager' },
    });

    await expect(handler(ctx)).rejects.toThrow('User not found');
  });

  it('rejects when role does not exist', async () => {
    const handler = buildChangeRole();

    let callCount = 0;
    mockStrapi.db.query.mockImplementation(() => {
      callCount++;
      // First call: user query (findOne returns user)
      if (callCount === 1) {
        return { findOne: vi.fn().mockResolvedValue({ id: 2, role: { type: 'customer' } }) };
      }
      // Second call: role query (findOne returns null)
      return { findOne: vi.fn().mockResolvedValue(null) };
    });

    const ctx = createMockCtx({
      params: { id: '2' },
      body: { role: 'nonexistent' },
    });

    await expect(handler(ctx)).rejects.toThrow("Role 'nonexistent' does not exist");
  });
});

describe('buildDeactivateUser', () => {
  it('deactivates a user successfully', async () => {
    const handler = buildDeactivateUser();
    const targetUser = { id: 2, username: 'user', email: 'user@test.com' };

    mockStrapi.db.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(targetUser),
      update: vi.fn().mockResolvedValue({}),
    });

    const ctx = createMockCtx({ params: { id: '2' }, user: { id: 1 } });
    await handler(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.body.user.is_active).toBe(false);
  });

  it('prevents self-deactivation', async () => {
    const handler = buildDeactivateUser();
    const ctx = createMockCtx({ params: { id: '1' }, user: { id: 1 } });

    await expect(handler(ctx)).rejects.toThrow(
      'Admins cannot deactivate their own account',
    );
  });

  it('rejects when target user does not exist', async () => {
    const handler = buildDeactivateUser();

    mockStrapi.db.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const ctx = createMockCtx({ params: { id: '999' }, user: { id: 1 } });
    await expect(handler(ctx)).rejects.toThrow('User not found');
  });
});

describe('buildResetPassword', () => {
  it('resets a user password successfully', async () => {
    const handler = buildResetPassword();
    const targetUser = { id: 2, username: 'user', email: 'user@test.com' };

    mockStrapi.db.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(targetUser),
      update: vi.fn().mockResolvedValue({}),
    });
    mockStrapi.plugin.mockReturnValue({
      service: () => ({
        hashPassword: vi.fn().mockResolvedValue('hashed_password'),
      }),
    });

    const ctx = createMockCtx({
      params: { id: '2' },
      body: { password: 'NewPass1word' },
      user: { id: 1 },
    });

    await handler(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.body.message).toBe('User password has been reset');
  });

  it('rejects when password is missing', async () => {
    const handler = buildResetPassword();
    const ctx = createMockCtx({ params: { id: '2' }, body: {} });

    await expect(handler(ctx)).rejects.toThrow('Password is required');
  });

  it('rejects weak password', async () => {
    const handler = buildResetPassword();
    const ctx = createMockCtx({
      params: { id: '2' },
      body: { password: 'weak' },
    });

    await expect(handler(ctx)).rejects.toThrow(
      'Password must be at least 8 characters with mixed case and numbers',
    );
  });

  it('rejects when target user does not exist', async () => {
    const handler = buildResetPassword();

    mockStrapi.db.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    });

    const ctx = createMockCtx({
      params: { id: '999' },
      body: { password: 'StrongP1ss' },
    });

    await expect(handler(ctx)).rejects.toThrow('User not found');
  });
});
