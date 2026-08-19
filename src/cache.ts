import { TTLCache } from '@isaacs/ttlcache'
import * as Sentry from '@sentry/node'
import { NestedResponse, Response } from './github'

export type CacheItem = {
  ts: number // UNIX timestamp in ms
  response: Response | NestedResponse
}

export const createCache = () => {
  const cache = new TTLCache<string, CacheItem>({
    max: 10_000,
    ttl: 60 * 60 * 1000, // one hour
  })

  const reportSize = () => {
    Sentry.metrics.gauge('cache.size', cache.size, {
      unit: 'item',
    })
  }

  reportSize()

  const interval = setInterval(reportSize, 60_000)
  interval.unref()

  return cache
}
export const ageInSeconds = (c: CacheItem) =>
  Math.floor((Date.now() - c.ts) / 1000)
