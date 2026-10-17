import { TTLCache } from '@isaacs/ttlcache'
import * as cheerio from 'cheerio'
import { eachDayOfInterval, format as formatDate } from 'date-fns'
import request from 'supertest'
import { errors as undici } from 'undici'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createApp, version } from '../src/app'
import * as github from '../src/github'
import testDataMultipleYears from './fixtures/grubersjoe-2017-2018.json'
import testDataNested from './fixtures/grubersjoe-2018-nested.json'
import testData from './fixtures/grubersjoe-2018.json'

vi.mock('cheerio', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cheerio')>()

  return {
    ...actual,
    fromURL: vi.fn(actual.fromURL), // allow spying on fromURL
  }
})

const username = 'grubersjoe'

describe('The :username endpoint', () => {
  let app = createApp()

  afterEach(() => {
    vi.restoreAllMocks()
    app = createApp()
  })

  test.each([[''], ['y=all']])('returns all data for query %s', async (y) => {
    await request(app)
      .get(`/${version}/${username}?${y}`)
      .expect(200)
      .expect(({ body }: { body: github.Response }) => {
        expect(Object.keys(body.total).length).toBeGreaterThanOrEqual(14)

        for (const count of Object.values(body.total)) {
          expect(typeof count).toBe('number')
        }
      })
  })

  test('returns data for a single year', () =>
    request(app)
      .get(`/${version}/${username}?y=2018`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toStrictEqual(testData)
      }))

  test('returns data for several years', async () =>
    request(app)
      .get(`/${version}/${username}?y=2017&y=2018`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toStrictEqual(testDataMultipleYears)
      }))

  test('returns data for the last year', () =>
    request(app)
      .get(`/${version}/${username}?y=last`)
      .expect(200)
      .expect(({ body }: { body: github.Response }) => {
        expect(Object.keys(body.total)).toContain('lastYear')
        expect(typeof body.total.lastYear).toBe('number')
      }))

  test('returns data in the nested format', () =>
    request(app)
      .get(`/${version}/${username}?y=2018&format=nested`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toStrictEqual(testDataNested)
      }))

  test('returns an empty response if no data is available', () =>
    request(app)
      .get(`/${version}/${username}?y=1900`)
      .expect(200)
      .expect(({ body }: { body: github.Response }) => {
        expect(body.total).toStrictEqual({ 1900: 0 })

        eachDayOfInterval({
          start: new Date(1900, 0, 1),
          end: new Date(1900, 11, 31),
        }).forEach((date, index) => {
          expect(body.contributions[index]).toStrictEqual({
            date: formatDate(date, 'yyyy-MM-dd'),
            count: 0,
            level: 0,
          })
        })
      }))

  test('returns HTTP 404 if the user cannot be found', async () => {
    const logSpy = vi.spyOn(global.console, 'error')
    const nonExistingUser = '43b83cb5-2d8f-44d3-b01c-98a73af7a15f'

    await request(app)
      .get(`/${version}/${nonExistingUser}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body).toStrictEqual({
          error: `GitHub user "${nonExistingUser}" not found.`,
        })
      })

    expect(logSpy).not.toHaveBeenCalled()
  })

  test('returns HTTP 400 for invalid username', () =>
    request(app)
      .get(`/${version}/-invalid`)
      .expect(400)
      .expect(({ body }) => {
        expect(body).toStrictEqual({
          error: `Invalid request`,
          issues: [
            {
              code: 'invalid_format',
              message: 'Invalid GitHub username',
              path: 'username',
            },
          ],
        })
      }))

  test.each([['y='], ['y=invalid'], ['y=2020abc'], ['y=abc2020']])(
    'returns HTTP 400 for invalid query %s',
    async (y) => {
      await request(app)
        .get(`/${version}/${username}?${y}`)
        .expect(400)
        .expect(({ body }) => {
          expect(body).toStrictEqual({
            error: `Invalid request`,
            issues: [
              {
                code: 'invalid_format',
                message:
                  'Invalid input: expected one or more number(s), "all" or "last"',
                path: 'y',
              },
            ],
          })
        })
    },
  )

  test.each([['format=invalid'], ['format=']])(
    'returns HTTP 400 for invalid format query %s',
    async (y) => {
      await request(app)
        .get(`/${version}/${username}?${y}`)
        .expect(400)
        .expect(({ body }) => {
          expect(body).toStrictEqual({
            error: `Invalid request`,
            issues: [
              {
                code: 'invalid_value',
                message: 'Invalid input: expected "nested"',
                path: 'format',
              },
            ],
          })
        })
    },
  )

  test('combines all validation errors', () =>
    request(app)
      .get(`/${version}/${username}?y=invalid&format=invalid`)
      .expect(400)
      .expect(({ body }) => {
        expect(body).toStrictEqual({
          error: 'Invalid request',
          issues: [
            {
              code: 'invalid_format',
              message:
                'Invalid input: expected one or more number(s), "all" or "last"',
              path: 'y',
            },
            {
              code: 'invalid_value',
              message: 'Invalid input: expected "nested"',
              path: 'format',
            },
          ],
        })
      }))

  test.each([
    [
      new undici.ResponseError('💥', 429, {
        headers: { 'retry-after': '300' },
      }),
      429,
      'GitHub: Too many requests.',
      { 'retry-after': '300' },
    ],
    [
      new Error('💥'),
      500,
      `Failed to scrape contributions of "${username}"`,
      {},
    ],
    [new undici.ResponseError('💥', 502, {}), 502, 'GitHub: Bad gateway.', {}],
    [
      new undici.ResponseError('💥', 503, {}),
      503,
      'GitHub: Service unavailable.',
      {},
    ],
    [
      new undici.ResponseError('💥', 504, {}),
      504,
      'GitHub: Gateway timeout.',
      {},
    ],
  ])(
    'returns HTTP $1 for respective error',
    async (err, expectedStatus, expectedError, expectedHeaders) => {
      vi.mocked(cheerio.fromURL).mockRejectedValueOnce(err)

      await request(app)
        .get(`/${version}/${username}`)
        .expect(expectedStatus)
        .expect(({ body, headers }) => {
          expect(body).toStrictEqual({ error: expectedError })

          for (const [header, value] of Object.entries(expectedHeaders)) {
            expect(headers[header]).toStrictEqual(value)
          }
        })
    },
  )

  test('does not leak internal errors', async () => {
    vi.spyOn(TTLCache.prototype, 'set').mockImplementation(() => {
      throw new Error('💥')
    })

    await request(app)
      .get(`/${version}/${username}`)
      .expect(500)
      .expect(({ body }) => {
        expect(body).toStrictEqual({
          error: 'Internal server error',
        })
      })
  })

  test('caches responses', async () => {
    const resp = await request(app)
      .get(`/${version}/${username}?y=2020`)
      .expect(200)
      .expect(({ headers }) => {
        expect(Number(headers.age)).toBe(0)
        expect(headers['x-cache']).toBe('MISS')
      })

    // ensure the age header changes
    await new Promise((resolve) => setTimeout(resolve, 1000))

    await request(app)
      .get(`/${version}/${username.toUpperCase()}?y=2020`) // ensure username casing does not matter
      .set('if-none-match', resp.get('etag') ?? '')
      .expect(304)
      .expect(({ headers }) => {
        expect(Number(headers.age)).toBeGreaterThanOrEqual(1)
        expect(headers['x-cache']).toBe('HIT')
      })
  })

  test('ignores cache for cache-control: no-cache', async () => {
    await request(app)
      .get(`/${version}/${username}?y=2020`)
      .expect(200)
      .expect(({ headers }) => {
        expect(Number(headers.age)).toBe(0)
        expect(headers['x-cache']).toBe('MISS')
      })

    await request(app)
      .get(`/${version}/${username}?y=2020`)
      .set('cache-control', 'no-cache')
      .expect(200)
      .expect(({ headers }) => {
        expect(Number(headers.age)).toBe(0)
        expect(headers['x-cache']).toBe('MISS')
      })
  })

  test('enforces rate limit', async () => {
    const originalEnv = process.env.NODE_ENV

    process.env.NODE_ENV = 'production' // enable rate limits
    app.set('rate_limit', 1)

    await request(app).get(`/${version}/${username}?y=2020`).expect(200)

    await request(app)
      .get(`/${version}/${username}?y=2020`)
      .expect(429)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: 'Too many requests, please try again later.',
        })
      })

    process.env.NODE_ENV = 'test'
    app.disable('rate_limit')

    process.env.NODE_ENV = originalEnv
  })
})
