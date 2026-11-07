import './instrument' // Must be the very first import
import * as Sentry from '@sentry/node'
import { createApp } from './app'
import { log } from './errors'

const app = createApp()
const port = process.env.PORT ?? 8080

const server = app.listen(port, (error) => {
  if (error) {
    log(`${new Date().toISOString()} ${error}`, 'error')
    process.exit(1)
  }
  log(`Server listening on http://localhost:${port}`)
})

const shutdown = (signal: NodeJS.Signals) => {
  server.closeAllConnections()
  server.close(() => {
    log(`${signal} - Server closed.`)
    void Sentry.close(2000).finally(() => {
      process.exit(0)
    })
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
