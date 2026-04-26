# Implementation Plan: Strapi Auth System

## Overview

Implement authentication and authorization for the Strapi 5 e-commerce backend by extending the existing `@strapi/plugin-users-permissions` plugin. The implementation adds JWT-based auth, role-based access control (Customer, Manager, Admin), custom policies, rate limiting middleware, and endpoint protection for the existing order, product, order-item, and analytics APIs.

## Tasks

- [x] 1. Configure users-permissions plugin and extend user schema
  - [x] 1.1 Configure the users-permissions plugin in `config/plugins.ts`
    - Set JWT expiration to 24h via `env('JWT_EXPIRATION', '24h')`
    - Configure allowed registration fields (`username`, `email`, `password`)
    - _Requirements: 2.1, 2.5_

  - [x] 1.2 Extend the user content type with auth fields
    - Create `src/extensions/users-permissions/content-types/user/schema.json`
    - Add `is_active` (boolean, default true), `failed_login_attempts` (integer, default 0), `locked_until` (datetime, nullable), `password_reset_token` (string), `password_reset_expires` (datetime)
    - _Requirements: 1.1, 7.2, 5.5, 5.6_

  - [ ]* 1.3 Write unit tests for user schema extension
    - Verify extended fields exist on user model with correct defaults
    - _Requirements: 1.1_

- [x] 2. Create custom policies for authentication and authorization
  - [x] 2.1 Create `src/policies/is-authenticated.ts`
    - Verify JWT token is present and valid on `ctx.state.user`
    - Return 401 UnauthorizedError if missing or invalid
    - _Requirements: 4.1, 4.7_

  - [x] 2.2 Create `src/policies/is-role.ts`
    - Factory policy accepting `config.roles` array (e.g., `['admin', 'manager']`)
    - Fetch the authenticated user's role via `strapi.plugin('users-permissions')`
    - Return 403 ForbiddenError if user's role type is not in allowed roles
    - _Requirements: 3.4, 4.4, 4.5_

  - [x] 2.3 Create `src/policies/is-owner.ts`
    - For customer-scoped endpoints, verify the authenticated user owns the resource
    - Managers and Admins bypass the ownership check
    - Return 403 ForbiddenError if customer tries to access another user's resource
    - _Requirements: 4.2, 4.3_

  - [x] 2.4 Create `src/policies/is-admin.ts`
    - Shorthand policy that checks for the Admin role specifically
    - Return 403 ForbiddenError if user is not Admin
    - _Requirements: 4.5, 6.1_

  - [ ]* 2.5 Write property tests for role-based access policies
    - **Property 9: Order access is role-scoped**
    - **Property 10: Product write access is role-restricted**
    - **Property 11: Analytics access is admin-only**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

- [x] 3. Implement audit logger and rate limiting middleware
  - [x] 3.1 Create `src/utils/audit-logger.ts`
    - Utility that logs security events (login success/failure, role changes, account deactivation, unauthorized access) via `strapi.log`
    - Include structured metadata: action type, actor ID, target ID, timestamp, IP address
    - _Requirements: 6.5, 7.6_

  - [x] 3.2 Create `src/middlewares/rate-limit.ts`
    - In-memory rate limiter tracking login attempts by IP + email combination
    - Configurable via `env('MAX_LOGIN_ATTEMPTS', 5)` and `env('ACCOUNT_LOCK_DURATION', 15)` (minutes)
    - Return 429 TooManyRequestsError with `Retry-After` header when threshold exceeded
    - Include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
    - _Requirements: 7.1, 7.2_

  - [x] 3.3 Register rate-limit middleware in `config/middlewares.ts`
    - Add the custom rate-limit middleware to the middleware stack, applied to auth endpoints
    - _Requirements: 7.1_

  - [ ]* 3.4 Write property test for rate limiting
    - **Property 16: Rate limiting enforces attempt threshold**
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 3.5 Write property test for audit logging
    - **Property 17: Security events produce audit logs**
    - **Validates: Requirements 6.5, 7.6**

- [x] 4. Checkpoint - Verify policies and middleware
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend auth controller for login/registration validation
  - [x] 5.1 Create `src/extensions/users-permissions/controllers/auth.ts`
    - Extend the default auth controller callback to:
      - Check `is_active` flag before allowing login (return 401 if deactivated)
      - Check `locked_until` before allowing login (return 429 if locked)
      - Increment `failed_login_attempts` on failed login
      - Reset `failed_login_attempts` on successful login
      - Log login success/failure via audit logger
    - _Requirements: 1.2, 1.3, 6.2, 7.2, 7.6_

  - [x] 5.2 Add password validation to registration flow
    - Validate password complexity: minimum 8 characters, mixed case, numbers
    - Validate email format before account creation
    - Return 400 ValidationError with descriptive messages on failure
    - _Requirements: 1.4, 1.6_

  - [x] 5.3 Add password change endpoint with current password verification
    - Extend user controller or add custom route for password change
    - Require current password verification before allowing change
    - Encrypt new password before storage
    - _Requirements: 5.3, 5.4_

  - [ ]* 5.4 Write property tests for auth validation
    - **Property 1: Password hashing round-trip**
    - **Property 3: Invalid credentials are rejected**
    - **Property 4: Registration input validation**
    - **Property 5: Duplicate email rejection**
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 1.6, 5.4**

  - [ ]* 5.5 Write unit tests for login flow
    - Test valid credentials, invalid credentials, deactivated account, locked account
    - _Requirements: 1.2, 1.3_

- [x] 6. Implement bootstrap script for default roles and permissions
  - [x] 6.1 Update `src/index.ts` bootstrap function
    - Create default roles (Customer, Manager, Admin) if they don't exist
    - Set default permissions for each role per the RBAC matrix in the design
    - Ensure new user registrations are assigned the Customer role by default
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [ ]* 6.2 Write property test for default role assignment
    - **Property 7: Default role assignment**
    - **Validates: Requirements 3.2**

- [x] 7. Protect existing API routes with auth policies
  - [x] 7.1 Update order routes with authentication and authorization
    - Modify `src/api/order/routes/order.ts` to use custom routes with policies
    - Modify `src/api/order/routes/order-custom.ts` to attach `is-authenticated` and `is-owner` policies
    - Customers can only access their own orders; Managers and Admins access all
    - _Requirements: 4.1, 4.2, 4.3, 8.1_

  - [x] 7.2 Update product routes with authentication and authorization
    - Modify `src/api/product/routes/product.ts` to use custom routes
    - `GET /products` remains public (no auth required)
    - `POST`, `PUT`, `DELETE` require `is-authenticated` + `is-role` with `['manager', 'admin']`
    - _Requirements: 4.4, 4.6, 8.2_

  - [x] 7.3 Update analytics routes with admin-only access
    - Modify `src/api/analytic/routes/custom-analytics.ts` to attach `is-authenticated` and `is-admin` policies to all analytics endpoints
    - _Requirements: 4.5, 8.3_

  - [x] 7.4 Update order-item routes with authentication
    - Modify `src/api/order-item/routes/order-item.ts` to require `is-authenticated` + `is-role` with `['manager', 'admin']`
    - _Requirements: 4.1_

  - [ ]* 7.5 Write integration tests for protected routes
    - Test full auth flow: register → login → access protected endpoint
    - Test role-based access for orders, products, analytics, order-items
    - Test public product read access without auth
    - Test 401/403 responses for unauthorized access
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.1, 8.2, 8.3_

- [x] 8. Implement admin user management endpoints
  - [x] 8.1 Create admin user management routes and controller
    - `GET /api/users` — List all users with role info (Admin only)
    - `PUT /api/users/:id/role` — Change user role (Admin only), validate role assignment permissions
    - `PUT /api/users/:id/deactivate` — Deactivate user (Admin only), prevent self-deactivation
    - `PUT /api/users/:id/reset-password` — Admin reset user password (Admin only)
    - Apply `is-authenticated` and `is-admin` policies to all admin routes
    - Log all admin actions via audit logger
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 3.3, 3.6_

  - [ ]* 8.2 Write property tests for admin operations
    - **Property 8: Role modification authorization**
    - **Property 14: Admin user listing completeness**
    - **Property 15: Account deactivation prevents login**
    - **Validates: Requirements 3.3, 3.6, 6.1, 6.2**

  - [ ]* 8.3 Write unit tests for admin endpoints
    - Test list users, deactivate user, change role, self-deletion prevention
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

- [x] 9. Implement CORS and security configuration
  - [x] 9.1 Update `config/middlewares.ts` with CORS and security settings
    - Configure CORS policies to restrict cross-origin requests to allowed origins
    - Ensure security middleware settings support auth-related headers
    - Add input validation/sanitization for auth endpoints
    - _Requirements: 7.3, 7.4, 7.5_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The implementation builds on the existing `@strapi/plugin-users-permissions` plugin already installed in the project
- All custom policies are created as global policies in `src/policies/` for reuse across APIs
