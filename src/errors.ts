export class UserNotFoundError extends Error {
  constructor(username: string) {
    super(`User \'${username}\' not found`);
  }
}
