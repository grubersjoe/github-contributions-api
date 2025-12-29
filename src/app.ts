import compression from 'compression'
import cors from 'cors'
import express, { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { router } from './api'

export const version = 'v4'

export const app = express()

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
app.use(`/${version}`, router)

const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
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

  console.error({ url: req.url, error })

  if (error instanceof Error) {
    res.status(500).json({ error: error.message })
  } else {
    res.status(500).json({ error: 'Internal' })
  }

  next()
}

// Lastly, override the default Express.js error handler.
app.use(errorHandler)
