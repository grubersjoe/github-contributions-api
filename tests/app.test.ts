import { Server } from 'http'
import request from 'supertest'
import { app, version } from '../src/app'
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
      })
      .timeout(8 * 1000),
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

  test('returns 404 if the user cannot be found', () => {
    const nonExistingUser = '43b83cb5-2d8f-44d3-b01c-98a73af7a15f'

    return request(app)
      .get(`/${version}/${nonExistingUser}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body).toStrictEqual({
          error: `GitHub user "${nonExistingUser}" not found.`,
        })
      })
  })

  test.each([['y='], ['y=invalid'], ['y=2020abc'], ['y=abc2020']])(
    'returns 400 for invalid y query %s',
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

  test('returns 500 for errors', () => {
    const scrapeContributionsMock = jest.spyOn(github, 'scrapeContributions')

    scrapeContributionsMock.mockImplementation(() => {
      throw new Error('unexpected error')
    })

    return request(app)
      .get(`/${version}/${username}`)
      .expect(500)
      .expect(({ body }) => {
        expect(body).toStrictEqual({
          error: `unexpected error`,
        })
      })
  })

  test('caches responses', async () =>
    request(app)
      .get(`/${version}/${username}?y=2020`)
      .expect(200)
      .expect(({ headers }) => {
        expect(Number(headers.age)).toBe(0)
        expect(headers['x-cache']).toBe('MISS')
      })
      .then(() => new Promise((resolve) => setTimeout(resolve, 1000)))
      .then(() =>
        request(app)
          .get(`/${version}/${username}?y=2020`)
          .expect(200)
          .expect(({ headers }) => {
            expect(Number(headers.age)).toBeGreaterThanOrEqual(1)
            expect(headers['x-cache']).toBe('HIT')
          }),
      ))

  test('ignores cache for cache-control: no-cache', async () =>
    request(app)
      .get(`/${version}/${username}?y=2020`)
      .expect(200)
      .expect(({ headers }) => {
        expect(Number(headers.age)).toBe(0)
        expect(headers['x-cache']).toBe('MISS')
      })
      .then(() =>
        request(app)
          .get(`/${version}/${username}?y=2020`)
          .set('cache-control', 'no-cache')
          .expect(200)
          .expect(({ headers }) => {
            expect(Number(headers.age)).toBe(0)
            expect(headers['x-cache']).toBe('MISS')
          }),
      ))
})
