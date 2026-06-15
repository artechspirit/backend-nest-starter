export const CacheKeys = {
  userPermissions: (userId: string) => `user:${userId}:permissions`,
  sessionUser: (sessionId: string) => `session:${sessionId}:user`,
  emailVerificationToken: (token: string) => `email-verify:token:${token}`,
  passwordResetToken: (token: string) => `password-reset:token:${token}`,
};
