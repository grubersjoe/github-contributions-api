import consoleStamp from 'console-stamp'
import app from './app'

// Globally wrap the console to add timestamps to every call.
consoleStamp(console, { format: ':date(isoDateTime)' })

const server = app.listen(process.env.PORT ?? 8080, () =>
  console.log(
    `Server listening on http://localhost:${process.env.PORT || 8080}`,
  ),
)

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('SIGTERM - HTTP server closed')
  })
})
