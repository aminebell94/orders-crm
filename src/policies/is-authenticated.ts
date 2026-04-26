import { errors } from '@strapi/utils';

const { UnauthorizedError } = errors;

/**
 * Global policy that verifies a valid JWT token is present.
 * Checks `policyContext.state.user` which is set by Strapi's
 * JWT middleware when a valid Authorization header is provided.
 *
 * Validates: Requirements 4.1, 4.7
 */
export default (policyContext, config, { strapi }) => {
  if (policyContext.state.user) {
    return true;
  }

  throw new UnauthorizedError('Missing or invalid credentials');
};
