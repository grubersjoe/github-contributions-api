import { styleText } from 'node:util'

export class ClientSafeError extends Error {}

export class HTTPError extends Error {
  readonly statusCode: number
  readonly headers: Record<string, string>

  constructor(
    statusCode: number,
    message: string,
    headers?: Record<string, string>,
  ) {
    super(message)
    this.statusCode = statusCode
    this.headers = headers ?? {}
  }
}

export const log = (message: string, level?: 'warn' | 'error') => {
  const time = styleText('magenta', `[${new Date().toISOString()}]`)
  const styledMessage = level === 'error' ? styleText('red', message) : message
  console[level ?? 'log'](`${time} ${styledMessage}`)
}
