import * as Sentry from '@sentry/node'
import { execFileSync } from 'node:child_process'
import { log } from './app'

const gitHash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
  encoding: 'utf8',
}).trim()

if (process.env.SENTRY_DSN) {
  Sentry.init({
    release: gitHash,
    dsn: process.env.SENTRY_DSN,
    integrations: [Sentry.nodeRuntimeMetricsIntegration()],
    tracesSampleRate: 1.0,
    dataCollection: {
      userInfo: true,
    },
  })
  log(`Sentry initialized`)
} else {
  log(`Sentry disabled`)
}
