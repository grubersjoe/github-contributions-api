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
    sampleRate: 0.25,
    tracesSampleRate: 0.1,
    beforeSendSpan(span) {
      if (span.is_segment) {
        span.attributes['cache.hit'] ??= false
      }
      return span
    },
    ignoreSpans: [
      {
        attributes: {
          'http.response.status_code': 429, // ignore rate-limited requests
        },
      },
    ],
  })
  log('Sentry initialized')
} else {
  log('Sentry disabled')
}
