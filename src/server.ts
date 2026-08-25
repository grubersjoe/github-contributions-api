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
  server.close(async () => {
    log(`${signal} - Server closed.`)
    await Sentry.close(2000)
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
