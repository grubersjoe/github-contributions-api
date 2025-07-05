import { Server } from 'http'
import cache from 'memory-cache'
import request from 'supertest'
import app from '../src/app'
import * as fetchService from '../src/scrape'
import testDataMultipleYears from './fixtures/grubersjoe-2017-2018.json'
import testDataNested from './fixtures/grubersjoe-2018-nested.json'
import testData from './fixtures/grubersjoe-2018.json'

const version = 'v4'
const username = 'grubersjoe'

describe('The :username endpoint', () => {
  let server: Server

  beforeEach((done) => {
    server = app.listen(done)
  })

  afterEach((done) => {
    cache.clear()
    server.close(done)
  })

  test('should return data for empty query', () =>
    request(app)
      .get(`/${version}/${username}`)
      .expect(200)
      .expect(({ body }) => expect(body.contributions).not.toHaveLength(0)))

  test('should return correct data for year', () =>
    request(app)
      .get(`/${version}/${username}?y=2018`)
      .expect(200)
      .expect(({ body }) => expect(body).toStrictEqual(testData)))

  test('should return correct data for multiple years', async () =>
    request(app)
      .get(`/${version}/${username}?y=2017&y=2018`)
      .expect(200)
      .expect((res) => expect(res.body).toStrictEqual(testDataMultipleYears)))

  test('should return correct data for last year', () =>
    request(app)
      .get(`/${version}/${username}?y=last`)
      .expect(200)
      .expect(({ body }) => {
        expect(Object.keys(body.total)).toContain('lastYear')
        expect(typeof body.total.lastYear).toBe('number')
      }))

  test('should return correct data for year in nested format', () =>
    request(app)
      .get(`/${version}/${username}?y=2018&format=nested`)
      .expect(200)
      .expect(({ body }) => expect(body).toStrictEqual(testDataNested)))

  test('should return empty response if no data is available', () =>
    request(app)
      .get(`/${version}/${username}?y=1900`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toStrictEqual({
          total: {},
          contributions: [],
        }),
      ))

  test('should respond 404 if user cannot be found', () => {
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
    'should respond 400 for invalid y query %s',
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
    'should respond 400 for invalid format query %s',
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

  test('should respond 500 for errors', () => {
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
      .expect((res) =>
        expect(res.body).toStrictEqual({
          error: `Failed scraping contribution data of '${username}': unexpected error`,
        }),
      )
  })
})
