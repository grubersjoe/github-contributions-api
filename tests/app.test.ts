import { Server } from 'http'
import request from 'supertest'
import app from '../src/app'
import * as fetchService from '../src/scrape'
import testDataMultipleYears from './fixtures/grubersjoe-2017-2018.json'
import testDataNested from './fixtures/grubersjoe-2018-nested.json'
import testData from './fixtures/grubersjoe-2018.json'
import { cache } from '../src/cache'

const version = 'v4'
const username = 'grubersjoe'

describe('The :username endpoint', () => {
  let server: Server

  beforeEach((done) => {
    server = app.listen(done)
  })

  afterEach((done) => {
    jest.restoreAllMocks()
    cache.clear()
    server.close(done)
  })

  test('returns data for empty query', () =>
    request(app)
      .get(`/${version}/${username}`)
      .expect(200)
      .expect(({ body }) => expect(body.contributions).not.toHaveLength(0)))

  test('returns data for a single year', () =>
    request(app)
      .get(`/${version}/${username}?y=2018`)
      .expect(200)
      .expect(({ body }) => expect(body).toStrictEqual(testData)))

  test('returns data for several years', async () =>
    request(app)
      .get(`/${version}/${username}?y=2017&y=2018`)
      .expect(200)
      .expect(({ body }) => expect(body).toStrictEqual(testDataMultipleYears)))

  test('returns data for the last year', () =>
    request(app)
      .get(`/${version}/${username}?y=last`)
      .expect(200)
      .expect(({ body }) => {
        expect(Object.keys(body.total)).toContain('lastYear')
        expect(typeof body.total.lastYear).toBe('number')
      }))

  test('returns data in the nested format', () =>
    request(app)
      .get(`/${version}/${username}?y=2018&format=nested`)
      .expect(200)
      .expect(({ body }) => expect(body).toStrictEqual(testDataNested)))

  test('returns an empty response if no data is available', () =>
    request(app)
      .get(`/${version}/${username}?y=1900`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toStrictEqual({
          total: {},
          contributions: [],
        }),
      ))

  test('returns 404 if the user cannot be found', () => {
    const nonExistingUser = '43b83cb5-2d8f-44d3-b01c-98a73af7a15f'

    return request(app)
      .get(`/${version}/${nonExistingUser}`)
      .expect(404)
      .expect(({ body }) =>
        expect(body).toStrictEqual({
          error: `User "${nonExistingUser}" not found.`,
        }),
      )
  })

  test.each([[`y=invalid`], [`y=2020abc`], [`y=abc2020`], [`y=`]])(
    'returns 400 for invalid y query %s',
    (y) =>
      request(app)
        .get(`/${version}/${username}?${y}`)
        .expect(400)
        .expect(({ body }) =>
          expect(body).toStrictEqual({
            error: "Query parameter 'y' must be an integer, 'all' or 'last'",
          }),
        ),
  )

  test.each([[`format=invalid`], [`format=`]])(
    'returns 400 for invalid format query %s',
    () =>
      request(app)
        .get(`/${version}/${username}?format=invalid`)
        .expect(400)
        .expect(({ body }) =>
          expect(body).toStrictEqual({
            error: "Query parameter 'format' must be 'nested' or undefined",
          }),
        ),
  )

  test('returns 500 for errors', () => {
    const fetchContributionsMock = jest.spyOn(
      fetchService,
      'scrapeGitHubContributions',
    )

    fetchContributionsMock.mockImplementation(() => {
      throw new Error('unexpected error')
    })

    return request(app)
      .get(`/${version}/${username}`)
      .expect(500)
      .expect(({ body }) =>
        expect(body).toStrictEqual({
          error: `Failed scraping contribution data of '${username}': unexpected error`,
        }),
      )
  })

  test('caches responses', async () => {
    jest.setTimeout(10 * 1000)

    return request(app)
      .get(`/${version}/${username}`)
      .expect(200)
      .expect(({ headers }) => {
        expect(Number(headers.age)).toBe(0)
        expect(headers['x-cache']).toBe('MISS')
      })
      .then(() => new Promise((resolve) => setTimeout(resolve, 1000)))
      .then(() =>
        request(app)
          .get(`/${version}/${username}`)
          .expect(200)
          .expect(({ headers }) => {
            expect(Number(headers.age)).toBeGreaterThan(0)
            expect(headers['x-cache']).toBe('HIT')
          }),
      )
  })

  test('ignores cache for cache-control: no-cache', async () => {
    jest.setTimeout(10 * 1000)

    return request(app)
      .get(`/${version}/${username}`)
      .expect(200)
      .expect(({ headers }) => expect(headers['x-cache']).toBe('MISS'))
      .then(() => new Promise((resolve) => setTimeout(resolve, 1000)))
      .then(() =>
        request(app)
          .get(`/${version}/${username}`)
          .set('cache-control', 'no-cache')
          .expect(200)
          .expect(({ headers }) => expect(headers['x-cache']).toBe('MISS')),
      )
  })
})
