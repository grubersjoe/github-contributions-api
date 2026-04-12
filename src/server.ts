import consoleStamp from 'console-stamp'
import { createApp } from './app'

// Globally wrap the console to add timestamps to every call.
consoleStamp(console, { format: ':date(isoDateTime)' })

const app = createApp()
const port = process.env.PORT ?? 8080

const server = app.listen(port, (error) => {
  if (error) {
    console.error(error)
    process.exit(1)
  }
  console.log(`Server listening on http://localhost:${port}`)
})

const shutdown = (signal: NodeJS.Signals) => {
  server.closeAllConnections()
  server.close(() => {
    console.log(`${signal} - Server closed.`)
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
