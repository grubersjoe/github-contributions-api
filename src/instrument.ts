import * as Sentry from '@sentry/node'
import { execFileSync } from 'node:child_process'
import { log } from './errors'

const gitHash = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
  } catch (error) {
    console.error(`Failed to determine git hash: ${String(error)}`)
    return undefined
  }
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    release: gitHash(),
    dsn: process.env.SENTRY_DSN,
    integrations: (defaults) => [
      ...defaults,
      Sentry.nodeRuntimeMetricsIntegration(),
    ],
    tracesSampleRate: 0.1,
    dataCollection: {
      userInfo: true,
    },
    beforeSendSpan(span) {
      if (span.is_segment) {
        span.data['cache.hit'] ??= false
      }
      return span
    },
  })
  log('Sentry initialized')
} else {
  log('Sentry disabled')
}
