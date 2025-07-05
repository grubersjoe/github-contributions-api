import compression from 'compression'
import cors from 'cors'
import { cache, cacheTTL, age } from './cache'

import express, { ErrorRequestHandler } from 'express'
import {
  NestedResponse,
  Response,
  scrapeGitHubContributions,
  UserNotFoundError,
  ParsedQuery,
} from './scrape'

interface ReqQuery {
  y?: string | Array<string>
  format?: 'nested'
}

type Request = express.Request<
  { username: string },
  Response | NestedResponse | { error: string },
  {},
  ReqQuery
>

export const version = 'v4'

const app = express()

app.use(cors())
app.use(compression())

app.get('/', (_, res) => {
  res.json({
    message: 'Welcome to the GitHub Contributions API.',
    version: `${version}`,
    docs: 'https://github.com/grubersjoe/github-contributions-api',
  })
})

app.get(`/${version}`, (_, res) => res.redirect('/'))

app.get(`/${version}/:username`, async (req: Request, res, next) => {
  const { username } = req.params

  if (req.query.format && req.query.format !== 'nested') {
    res.status(400).send({
      error: "Query parameter 'format' must be 'nested' or undefined",
    })
    return
  }

  const years =
    req.query.y != null
      ? typeof req.query.y === 'string'
        ? [req.query.y]
        : req.query.y
      : []

  if (years.some((y) => !/^\d+$/.test(y) && y !== 'all' && y !== 'last')) {
    res.status(400).send({
      error: "Query parameter 'y' must be an integer, 'all' or 'last'",
    })
    return
  }

  const query = {
    years: years.map((y) => parseInt(y)).filter(isFinite),
    fetchAll: years.includes('all') || years.length === 0,
    lastYear: years.includes('last'),
    format: req.query.format,
  } satisfies ParsedQuery

  const cacheKey = `${username}-${JSON.stringify(query)}`

  if (req.header('cache-control') !== 'no-cache') {
    const cached = cache.get(cacheKey)

    if (cached !== null) {
      res.setHeader('age', age(cached))
      res.setHeader('x-cache', 'HIT')
      res.json(cached.response)
      return
    }
  }

  try {
    const response = await scrapeGitHubContributions(username, query)
    cache.put(cacheKey, { ts: Date.now(), response: response }, cacheTTL)
    res.setHeader('age', 0)
    res.setHeader('x-cache', 'MISS')
    res.json(response)
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      res.status(404).send({
        error: error.message,
      })
      return
    }

    next(
      new Error(
        `Failed scraping contribution data of '${username}': ${
          error instanceof Error ? error.message : 'Unknown error.'
        }`,
      ),
    )
  }
})

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  console.error(error)
  res.status(500).json({
    error: error.message,
  })
  next()
}

// This needs to come last to override the default Express.js error handler.
// The order of middleware matters.
app.use(errorHandler)

export default app
