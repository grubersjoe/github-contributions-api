import app from './index'

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
