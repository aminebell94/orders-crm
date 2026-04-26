/**
 * Unit tests for the register override in strapi-server.ts
 *
 * Validates: Requirements 1.4, 1.6
 */

import { describe, it, expect, vi } from 'vitest';

import extendPlugin from './strapi-server';

function createMockCtx(body: Record<string, any> = {}) {
  return {
    request: { body, ip: '127.0.0.1' },
    status: 200,
    body: null as any,
    set: vi.fn(),
  };
}

function createMockPlugin() {
  const originalRegister = vi.fn();
  const plugin = {
    controllers: {
      auth: {
        callback: vi.fn(),
        register: originalRegister,
      },
      user: {} as Record<string, any>,
    },
    routes: {
      'content-api': { routes: [] as any[] },
    },
  };
  return { plugin, originalRegister };
}

describe('strapi-server register override', () => {
  it('rejects registration with invalid email', async () => {
    const { plugin, originalRegister } = createMockPlugin();
    const extended = extendPlugin(plugin);

    const ctx = createMockCtx({ email: 'not-an-email', password: 'Valid1Pass' });
    await extended.controllers.auth.register(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body.error.name).toBe('ValidationError');
    expect(ctx.body.error.message).toBe('Invalid email format');
    expect(originalRegister).not.toHaveBeenCalled();
  });

  it('rejects registration with weak password', async () => {
    const { plugin, originalRegister } = createMockPlugin();
    const extended = extendPlugin(plugin);

    const ctx = createMockCtx({ email: 'user@example.com', password: 'weak' });
    await extended.controllers.auth.register(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body.error.name).toBe('ValidationError');
    expect(ctx.body.error.message).toContain('Password must be at least 8 characters');
    expect(originalRegister).not.toHaveBeenCalled();
  });

  it('calls original register for valid input', async () => {
    const { plugin, originalRegister } = createMockPlugin();
    const extended = extendPlugin(plugin);

    const ctx = createMockCtx({ email: 'user@example.com', password: 'StrongP1ss' });
    await extended.controllers.auth.register(ctx);

    expect(originalRegister).toHaveBeenCalledWith(ctx);
    expect(ctx.status).toBe(200);
  });

  it('rejects registration with missing fields', async () => {
    const { plugin, originalRegister } = createMockPlugin();
    const extended = extendPlugin(plugin);

    const ctx = createMockCtx({});
    await extended.controllers.auth.register(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body.error.name).toBe('ValidationError');
    expect(originalRegister).not.toHaveBeenCalled();
  });
});
