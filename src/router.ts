import { Application, type Request, Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { HTTPError, isHTTPError } from './app'
import { ageInSeconds, createCache } from './cache'
import { NestedResponse, Response, scrapeContributions } from './github'

export const createRouter = (app: Application) => {
  const router = Router()
  const cache = createCache()

  const limiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    limit: () => app.get('rate_limit') ?? 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },

    // Rate-limit all uncached requests but ignore tests.
    skip: (req) => {
      if (process.env.NODE_ENV === 'test') {
        return true
      }

      if (req.header('cache-control') === 'no-cache') {
        return false
      }

      return Boolean(
        cache.get(
          getCacheKey(
            routeSchema.parse(req.params).username,
            querySchema.parse(req.query),
          ),
        ),
      )
    },
  })

  router.get(`/:username`, limiter, async (req: Req, res) => {
    const { username } = routeSchema.parse(req.params)
    const query = querySchema.parse(req.query)

    const cacheKey = getCacheKey(username, query)

    if (req.header('cache-control') !== 'no-cache') {
      const cached = cache.get(cacheKey)

      if (cached !== null) {
        res.setHeader('age', ageInSeconds(cached))
        res.setHeader('x-cache', 'HIT')
        res.json(cached.response)
        return
      }
    }

    const response = await scrapeContributions(username, query).catch(
      (error: unknown) => {
        if (isHTTPError(error) && error.statusCode === 404) {
          throw new HTTPError(404, `GitHub user "${username}" not found.`)
        }
        throw error
      },
    )

    cache.put(cacheKey, { ts: Date.now(), response }, 1000 * 60 * 60) // one hour
    res.setHeader('age', 0)
    res.setHeader('x-cache', 'MISS')

    res.json(response)
  })

  return router
}

const routeSchema = z.object({
  username: z.string().min(1),
})

const querySchema = z.object({
  y: z
    .union([
      z.string().regex(/^(?:\d+|all|last)$/),
      z.array(z.string().regex(/^\d+$/)),
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
      const parsed = z.array(z.int()).safeParse(years)

      if (!parsed.success) {
        ctx.addIssue({
          code: 'invalid_value',
          message: parsed.error.message,
          values: years,
        })
        return z.NEVER
      }

      return uniq(parsed.data)
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

const getCacheKey = (username: string, query: ReqQuery) =>
  `${username}-${JSON.stringify(query)}`

const uniq = <T = unknown>(a: Array<T>) => [...new Set(a)]
