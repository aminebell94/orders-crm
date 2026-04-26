/**
 * Unit tests for registration validation utilities.
 *
 * Validates: Requirements 1.4, 1.6
 */

import { describe, it, expect } from 'vitest';
import {
  isValidPassword,
  isValidEmail,
  validateRegistrationInput,
} from './validation';

describe('isValidPassword', () => {
  it('accepts a valid password with mixed case and numbers', () => {
    expect(isValidPassword('Abcdef1x')).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(isValidPassword('Ab1cdef')).toBe(false);
  });

  it('rejects passwords without uppercase letters', () => {
    expect(isValidPassword('abcdefg1')).toBe(false);
  });

  it('rejects passwords without lowercase letters', () => {
    expect(isValidPassword('ABCDEFG1')).toBe(false);
  });

  it('rejects passwords without numbers', () => {
    expect(isValidPassword('Abcdefgh')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidPassword('')).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(isValidPassword(null as any)).toBe(false);
    expect(isValidPassword(undefined as any)).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('accepts a standard email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('accepts email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true);
  });

  it('rejects email without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects email without local part', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('rejects email with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(isValidEmail(null as any)).toBe(false);
    expect(isValidEmail(undefined as any)).toBe(false);
  });
});

describe('validateRegistrationInput', () => {
  it('returns no errors for valid input', () => {
    const errors = validateRegistrationInput({
      email: 'user@example.com',
      password: 'StrongP1ss',
    });
    expect(errors).toEqual([]);
  });

  it('returns email error for invalid email', () => {
    const errors = validateRegistrationInput({
      email: 'bad-email',
      password: 'StrongP1ss',
    });
    expect(errors).toContain('Invalid email format');
    expect(errors).toHaveLength(1);
  });

  it('returns password error for weak password', () => {
    const errors = validateRegistrationInput({
      email: 'user@example.com',
      password: 'weak',
    });
    expect(errors).toContain(
      'Password must be at least 8 characters with mixed case and numbers',
    );
    expect(errors).toHaveLength(1);
  });

  it('returns both errors when both are invalid', () => {
    const errors = validateRegistrationInput({
      email: 'bad',
      password: 'bad',
    });
    expect(errors).toHaveLength(2);
  });

  it('returns errors when fields are missing', () => {
    const errors = validateRegistrationInput({});
    expect(errors).toHaveLength(2);
  });
});
