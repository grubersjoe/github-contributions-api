import * as Sentry from '@sentry/node'
import { execFileSync } from 'node:child_process'

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
    tracesSampleRate: 1.0,
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
  console.log(`Sentry initialized`)
} else {
  console.log(`Sentry disabled`)
}
