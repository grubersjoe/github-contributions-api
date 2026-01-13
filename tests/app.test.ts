import { Server } from 'http'
import request from 'supertest'
import { app, version, HTTPError } from '../src/app'
import { cache } from '../src/cache'
import * as github from '../src/github'
import { Response } from '../src/github'
import testDataMultipleYears from './fixtures/grubersjoe-2017-2018.json'
import testDataNested from './fixtures/grubersjoe-2018-nested.json'
import testData from './fixtures/grubersjoe-2018.json'

const username = 'grubersjoe'

describe('The :username endpoint', () => {
  let server: Server

  beforeEach((done) => {
    server = app.listen(done)
  })

  afterEach((done) => {
    jest.restoreAllMocks()
    cache.clear()
    server.closeAllConnections()
    server.close(done)
  })

  test.each([[''], ['y=all']])('returns all data for query %s', (y) =>
    request(app)
      .get(`/${version}/${username}?${y}`)
      .expect(200)
      .expect(({ body }: { body: Response }) => {
        expect(Object.keys(body.total).length).toBeGreaterThanOrEqual(14)

        for (const count of Object.values(body.total)) {
          expect(typeof count).toBe('number')
        }
      }),
  )

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
      .expect(({ body }: { body: Response }) => {
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
      .expect(({ body }) => {
        expect(body).toStrictEqual({
          total: {},
          contributions: [],
        })
      }))

  test.each([[''], ['y=last']])(
    'returns 404 if the user cannot be found for query %s',
    async (y) => {
      const nonExistingUser = '43b83cb5-2d8f-44d3-b01c-98a73af7a15f'

      const logSpy = jest.spyOn(global.console, 'error')

      await request(app)
        .get(`/${version}/${nonExistingUser}?${y}`)
        .expect(404)
        .expect(({ body }) => {
          expect(body).toStrictEqual({
            error: `GitHub user "${nonExistingUser}" not found.`,
          })
        })

      expect(logSpy).not.toHaveBeenCalled()
    },
  )

  test.each([['y='], ['y=invalid'], ['y=2020abc'], ['y=abc2020']])(
    'returns 400 for invalid query %s',
    (y) =>
      request(app)
        .get(`/${version}/${username}?${y}`)
        .expect(400)
        .expect(({ body }) => {
          expect(body).toStrictEqual({
            error: `Invalid request`,
            issues: [
              {
                code: 'invalid_format',
                message:
                  'Invalid string: must match pattern /^(?:\\d+|all|last)$/',
                path: 'y',
              },
            ],
          })
        }),
  )

  test.each([['format=invalid'], ['format=']])(
    'returns 400 for invalid format query %s',
    () =>
      request(app)
        .get(`/${version}/${username}?format=invalid`)
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
        }),
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
                'Invalid string: must match pattern /^(?:\\d+|all|last)$/',
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

  test('skips duplicate y parameters', async () => {
    const scrapeContributionsSpy = jest.spyOn(github, 'scrapeContributions')
    await request(app).get(`/${version}/${username}?y=2020&y=2020`).expect(200)
    expect(scrapeContributionsSpy).toHaveBeenCalledTimes(1)
  })

  test.each([[new HTTPError(500, '💥')], [new Error('💥')]])(
    'returns 500 for errors and writes log',
    async (err) => {
      const scrapeContributionsMock = jest.spyOn(github, 'scrapeContributions')

      scrapeContributionsMock.mockImplementation(() => {
        throw err
      })

      const logSpy = jest.spyOn(global.console, 'error')

      await request(app)
        .get(`/${version}/${username}`)
        .expect(500)
        .expect(({ body }) => {
          expect(body).toStrictEqual({
            error: '💥',
          })
        })

      expect(logSpy).toHaveBeenCalledTimes(1)
    },
  )

  test('caches responses', async () => {
    await request(app)
      .get(`/${version}/${username}?y=2020`)
      .expect(200)
      .expect(({ headers }) => {
        expect(Number(headers.age)).toBe(0)
        expect(headers['x-cache']).toBe('MISS')
      })

    // ensure the age header changes
    await new Promise((resolve) => setTimeout(resolve, 1000))

    await request(app)
      .get(`/${version}/${username}?y=2020`)
      .expect(200)
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

  test('enforces rate limit for cache-control: no-cache', async () => {
    process.env.NODE_ENV = 'production' // enable rate limits
    app.set('rate_limit', 1)

    await request(app)
      .get(`/${version}/${username}?y=2020`)
      .set('cache-control', 'no-cache')
      .expect(200)

    await request(app)
      .get(`/${version}/${username}?y=2020`)
      .set('cache-control', 'no-cache')
      .expect(429)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: 'Too many requests, please try again later.',
        })
      })

    process.env.NODE_ENV = 'test'
    app.disable('rate_limit')
  })

  test('has no rate limit for cached requests', async () => {
    process.env.NODE_ENV = 'production' // enable rate limits
    app.set('rate_limit', 1)

    await request(app).get(`/${version}/${username}?y=2020`).expect(200)
    await request(app).get(`/${version}/${username}?y=2020`).expect(200)

    process.env.NODE_ENV = 'test'
    app.disable('rate_limit')
  })
})
