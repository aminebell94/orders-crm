/**
 * Registration Validation Utilities
 *
 * Provides password complexity and email format validation
 * for the registration flow.
 *
 * Validates: Requirements 1.4, 1.6
 */

/**
 * Validates password complexity:
 * - Minimum 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one digit
 */
export function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
}

/**
 * Validates email format using a standard regex pattern.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates registration input and returns an array of error messages.
 * Returns an empty array if all validations pass.
 */
export function validateRegistrationInput(body: {
  email?: string;
  password?: string;
}): string[] {
  const errors: string[] = [];

  if (!body.email || !isValidEmail(body.email)) {
    errors.push('Invalid email format');
  }

  if (!body.password || !isValidPassword(body.password)) {
    errors.push(
      'Password must be at least 8 characters with mixed case and numbers',
    );
  }

  return errors;
}
