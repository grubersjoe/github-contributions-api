import * as Sentry from '@sentry/node'
import { Application, type Request, Router } from 'express'
import rateLimit from 'express-rate-limit'
import stableStringify from 'json-stable-stringify'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { ageInSeconds, CacheItem, createCache } from './cache'
import { ClientSafeError, HTTPError, isHTTPError } from './errors'
import { NestedResponse, Response, scrapeContributions } from './github'

export const createRouter = (app: Application) => {
  const router = Router()
  const cache = createCache()

  const limiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    limit: () => app.get('rate_limit') ?? 10,
    skip: () => process.env.NODE_ENV === 'test', // ignore tests
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      Sentry.metrics.count('http.rate_limit', 1, {
        attributes: {
          route: '/:username',
        },
      })

      return res
        .status(options.statusCode)
        .send({ error: 'Too many requests, please try again later.' })
    },
  })

  router.get(`/:username`, limiter, async (req: Req, res) => {
    const { username } = routeSchema.parse(req.params)
    const query = querySchema.parse(req.query)

    const cacheKey = getCacheKey(username, query)

    if (req.header('cache-control') !== 'no-cache') {
      const cached = Sentry.startSpan(
        {
          name: cacheKey,
          attributes: {
            'cache.key': [cacheKey],
          },
          op: 'cache.get',
        },
        (span) => {
          const item = cache.get(cacheKey)
          const cacheHit = item !== undefined

          span.setAttribute('cache.hit', cacheHit)
          Sentry.getRootSpan(span).setAttribute('cache.hit', cacheHit)

          if (cacheHit) {
            span.setAttribute('cache.item_size', JSON.stringify(item).length)
          }

          return item
        },
      )

      if (cached !== undefined) {
        res.setHeader('age', ageInSeconds(cached))
        res.setHeader('x-cache', 'HIT')
        res.json(cached.response)
        return
      }
    }

    const response = await scrapeContributions(username, query).catch(
      (error: unknown) => {
        if (isHTTPError(error)) {
          switch (error.statusCode) {
            case 404:
              throw new HTTPError(404, `GitHub user "${username}" not found.`)
            case 502:
              throw new HTTPError(502, `GitHub: Bad gateway.`)
            case 503:
              throw new HTTPError(503, `GitHub: Service unavailable.`)
            case 504:
              throw new HTTPError(504, `GitHub: Gateway timeout.`)
          }
        }

        throw new ClientSafeError(
          `Failed to scrape contributions of "${username}"`,
        )
      },
    )

    const cacheItem: CacheItem = { ts: Date.now(), response }

    Sentry.startSpan(
      {
        name: cacheKey,
        attributes: {
          'cache.key': [cacheKey],
          'cache.ttl': cache.ttl ? cache.ttl / 1000 : undefined,
          'cache.item_size': JSON.stringify(cacheItem).length,
        },
        op: 'cache.put',
      },
      () => {
        cache.set(cacheKey, cacheItem)
      },
    )

    res.setHeader('age', 0)
    res.setHeader('x-cache', 'MISS')

    res.json(response)
  })

  return router
}

const routeSchema = z.object({
  // GitHub: Username may only contain alphanumeric characters or single hyphens,
  // and cannot begin or end with a hyphen.
  username: z
    .string()
    .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, {
      error: 'Invalid GitHub username',
    })
    .transform((u) => u.toLowerCase()),
})

const querySchema = z.object({
  y: z
    .union([
      z.string().regex(/^(?:\d+|all|last)$/, {
        error: 'Invalid input: expected one or more number(s), "all" or "last"',
      }),
      z.array(
        z.string().regex(/^\d+$/, {
          error:
            'Invalid input: expected one or more number(s), "all" or "last"',
        }),
      ),
    ])
    .optional()
    .transform((y, ctx) => {
      if (y === undefined) {
        return 'all'
      }

      if (y === 'all' || y === 'last') {
        return y
      }

      const years = typeof y === 'string' ? [Number(y)] : y.map(Number)
      const parsedYears = z.array(z.int()).safeParse(years)

      if (!parsedYears.success) {
        ctx.addIssue({
          code: 'invalid_value',
          message: parsedYears.error.message,
          values: years,
        })
        return z.NEVER
      }

      return uniq(parsedYears.data).sort()
    }),
  format: z.literal('nested').optional(),
})

type ReqRouteParams = z.infer<typeof routeSchema>
export type ReqQuery = z.output<typeof querySchema>

type ErrorResponse = {
  error: string
  issues?: Array<{
    code: string
    path: string
    message: string
  }>
}

type Req = Request<
  ReqRouteParams,
  Response | NestedResponse | ErrorResponse,
  Record<string, never>,
  z.input<typeof querySchema>
>

const getCacheKey = (username: string, query: ReqQuery) => {
  const queryString = stableStringify(query)
  if (!queryString) {
    throw new Error('Unexpected error: empty query')
  }

  const queryHash = createHash('sha256').update(queryString).digest('base64url')

  return `cache-${username.toLowerCase()}-${queryHash}`
}

const uniq = <T = unknown>(a: Array<T>) => [...new Set(a)]
