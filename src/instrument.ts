import * as Sentry from '@sentry/node'
import { log } from './app'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [Sentry.nodeRuntimeMetricsIntegration()],
    tracesSampleRate: 1.0,
    dataCollection: {
      userInfo: true,
    },
  })
  log(`Sentry initialized for DSN ${process.env.SENTRY_DSN}`)
} else {
  log(`Sentry disabled`)
}
