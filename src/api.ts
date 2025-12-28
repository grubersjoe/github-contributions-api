import express from 'express'
import { z } from 'zod'
import { ageInSeconds, cache, cacheTTL } from './cache'
import {
  NestedResponse,
  Response,
  scrapeContributions,
  UserNotFoundError,
} from './github'

const routeSchema = z.object({
  username: z.string().min(1),
})

const querySchema = z.object({
  y: z
    .union([
      z.array(z.string().regex(/^\d+$/)),
      z.string().regex(/^\d+$/),
      z.literal('all'),
      z.literal('last'),
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
          message: `Invalid input: expected an integer, "all" or "last"`,
          values: years,
        })
        return z.NEVER
      }

      return parsed.data
    }),
  format: z.literal('nested').optional(),
})

type ReqRouteParams = z.infer<typeof routeSchema>
export type ReqQuery = z.infer<typeof querySchema>

type ErrorResponse = {
  error: string
  issues?: Array<{
    code: string
    path: string
    message: string
  }>
}

type Req = express.Request<
  ReqRouteParams,
  Response | NestedResponse | ErrorResponse,
  Record<string, never>,
  ReqQuery
>

export const router = express.Router()

router.get(`/:username`, async (req: Req, res, next) => {
  const { username } = routeSchema.parse(req.params)
  const query = querySchema.parse(req.query)

  const cacheKey = `${username}-${JSON.stringify(query)}`

  if (req.header('cache-control') !== 'no-cache') {
    const cached = cache.get(cacheKey)

    if (cached !== null) {
      res.setHeader('age', ageInSeconds(cached))
      res.setHeader('x-cache', 'HIT')
      res.json(cached.response)
      return
    }
  }

  try {
    const response = await scrapeContributions(username, query)

    cache.put(cacheKey, { ts: Date.now(), response }, cacheTTL)
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

    next(error)
  }
})
