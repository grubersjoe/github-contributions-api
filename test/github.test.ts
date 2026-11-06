import request from 'supertest'
import { describe, expect, test } from 'vitest'
import { createApp, version } from '../src/app'
import * as github from '../src/github'
import testData from './fixtures/grubersjoe-2018.json'

// These tests query GitHub directly to detect changes of its responses.
const username = 'grubersjoe'

describe('GitHub', () => {
  const app = createApp()

  test('returns the known data of a past year', () =>
    request(app)
      .get(`/${version}/${username}?y=2018`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toStrictEqual(testData)
      }))

  test('returns data for the last year', () =>
    request(app)
      .get(`/${version}/${username}?y=last`)
      .expect(200)
      .expect(({ body }: { body: github.Response }) => {
        expect(typeof body.total.lastYear).toBe('number')
        expect(body.contributions.length).toBeGreaterThanOrEqual(365)
      }))

  test('finds the years of a user', async () => {
    const years = await github.fetchAllYearsFor(username)

    expect(years).toContain(2018)
  })

  test('returns HTTP 404 if the user cannot be found', () => {
    const nonExistingUser = '43b83cb5-2d8f-44d3-b01c-98a73af7a15f'

    return request(app)
      .get(`/${version}/${nonExistingUser}?y=2018`)
      .expect(404)
      .expect(({ body }) => {
        expect(body).toStrictEqual({
          error: `GitHub user "${nonExistingUser}" not found.`,
        })
      })
  })
})
