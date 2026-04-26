export default ({ env }) => ({
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: env('JWT_EXPIRATION', '24h'),
      },
      register: {
        allowedFields: ['username', 'email', 'password'],
      },
    },
  },
});
