import * as Sentry from '@sentry/node'
import { execFileSync } from 'node:child_process'

const gitHash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
  encoding: 'utf8',
}).trim()

if (process.env.SENTRY_DSN) {
  Sentry.init({
    release: gitHash,
    dsn: process.env.SENTRY_DSN,
    integrations: (defaults) => [
      ...defaults,
      Sentry.nodeRuntimeMetricsIntegration(),
    ],
    tracesSampleRate: 1.0,
    dataCollection: {
      userInfo: true,
    },
  })
  console.log(`Sentry initialized`)
} else {
  console.log(`Sentry disabled`)
}
