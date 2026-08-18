import * as Sentry from '@sentry/node'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [Sentry.nodeRuntimeMetricsIntegration()],
    tracesSampleRate: 1.0,
    dataCollection: {
      userInfo: true,
    },
  })
}
