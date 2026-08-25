export class ClientSafeError extends Error {}

export class HTTPError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

export const isHTTPError = (error: unknown): error is HTTPError =>
  error instanceof Error && Object.hasOwnProperty.call(error, 'statusCode')

export const log = (message: string, level?: 'warn' | 'error') => {
  console[level ?? 'log'](`${new Date().toISOString()}: ${message}`)
}
