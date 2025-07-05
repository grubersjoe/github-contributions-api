import memoryCache from 'memory-cache'
import { Response, NestedResponse } from './scrape'

type CacheItem = {
  ts: number // UNIX timestamp in ms
  response: Response | NestedResponse
}

export const cache = new memoryCache.Cache<string, CacheItem>()

export const cacheTTL = 1000 * 60 * 60 // one hour

export const ageInSeconds = (c: CacheItem) =>
  Math.round((Date.now() - c.ts) / 1000)
