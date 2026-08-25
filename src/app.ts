import { setupExpressErrorHandler } from '@sentry/node'
import compression from 'compression'
import cors from 'cors'
import express, { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { isHTTPError, ClientSafeError, log } from './errors'
import { createRouter } from './router'

export const version = 'v4'

export const createApp = () => {
  const app = express()
  app.set('trust proxy', 1) // required to correctly resolve IP addresses for rate limiting

  app.use(cors())
  app.use(compression())

  app.get('/', (_req, res) => {
    res.json({
      message: 'Welcome to the GitHub Contributions API.',
      version,
      docs: 'https://github.com/grubersjoe/github-contributions-api',
    })
  })

  app.get(`/${version}`, (_, res) => {
    res.redirect('/')
  })

  app.use(`/${version}`, createRouter(app))

  if (process.env.SENTRY_DSN) {
    setupExpressErrorHandler(app)
  }

  app.use(errorHandler) // Needs to be last

  return app
}

const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  // Do not remove. Express.js detects error handlers by parameter arity (great idea).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next,
) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Invalid request',
      issues: error.issues.map((i) => ({
        code: i.code,
        path: i.path.join('.'),
        message: i.message,
      })),
    })
    return
  }

  if (isHTTPError(error)) {
    res.status(error.statusCode).json({ error: error.message })
  } else if (error instanceof ClientSafeError) {
    res.status(500).json({ error: error.message })
  } else {
    res.status(500).json({ error: 'Internal server error' })
    log(error instanceof Error ? error.message : 'Unknown error', 'error')
  }
}
