import memoryCache from 'memory-cache'
import { NestedResponse, Response } from './github'

type CacheItem = {
  ts: number // UNIX timestamp in ms
  response: Response | NestedResponse
}

export const createCache = () => new memoryCache.Cache<string, CacheItem>()

export const ageInSeconds = (c: CacheItem) =>
  Math.floor((Date.now() - c.ts) / 1000)
