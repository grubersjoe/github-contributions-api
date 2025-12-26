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

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  console.error(error)

  if (error instanceof ZodError) {
    const issues = error.issues.map((i) => `${i.path}: ${i.message}.`).join(' ')
    res.status(400).json({ error: issues })
  } else if (error instanceof Error) {
    res.status(500).json({ error: error.message })
  } else {
    res.status(500).json({ error: 'internal' })
  }

  next()
}

// Lastly, override the default Express.js error handler.
app.use(errorHandler)
