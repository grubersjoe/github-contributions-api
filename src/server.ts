import consoleStamp from 'console-stamp'
import app from './app'

// Globally wrap the console to add timestamps to every call.
consoleStamp(console, { format: ':date(isoDateTime)' })

const port = process.env.PORT ?? 8080

const server = app.listen(port, () =>
  console.log(`Server listening on http://localhost:${port}`),
)

function shutdown(signal: NodeJS.Signals) {
  server.closeAllConnections()
  server.close(() => {
    console.log(`${signal} - Server closed.`)
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
