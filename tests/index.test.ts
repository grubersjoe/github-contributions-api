import request from 'supertest';

import app from '../src';
import * as fetchService from '../src/fetch';

import testData from './fixtures/grubersjoe-2018.json';
import testDataMultipleYears from './fixtures/grubersjoe-2017-2018.json';
import testDataNested from './fixtures/grubersjoe-2018-nested.json';

const version = 4;
const username = 'grubersjoe';

describe('The :username endpoint', () => {
  test('should return correct data for specific year', async () => {
    const response = await request(app).get(`/v${version}/${username}?y=2018`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(testData);
  });

  test('should return correct data for multiple years', async () => {
    const response = await request(app).get(
      `/v${version}/${username}?y=2017&y=2018`,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(testDataMultipleYears);
  });

  test('should return correct data for last year', async () => {
    const response = await request(app).get(`/v${version}/${username}?y=last`);
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body.total)).toContain('lastYear');
    expect(typeof response.body.total.lastYear).toBe('number');
  });

  test('should return correct data for specific year in nested format', async () => {
    const response = await request(app).get(
      `/v${version}/${username}?y=2018&format=nested`,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(testDataNested);
  });

  test('should return empty response if no data is available', async () => {
    const response = await request(app).get(`/v${version}/${username}?y=1900`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual({
      total: {},
      contributions: [],
    });
  });

  test('should respond 404 if user cannot be found', async () => {
    const username = '9520460126';
    const response = await request(app).get(`/v${version}/${username}`);
    expect(response.statusCode).toBe(404);
    expect(response.body).toStrictEqual({
      error: `User \'${username}\' not found`,
    });
  });

  test.each([[`y=invalid`], [`y=2020abc`], [`y=abc2020`], [`y=`]])(
    'should respond 400 for invalid y query parameter %s',
    async y => {
      const response = await request(app).get(`/v${version}/${username}?${y}`);
      expect(response.statusCode).toBe(400);
      expect(response.body).toStrictEqual({
        error: "Query parameter 'y' must be an integer, 'all' or 'last'",
      });
    },
  );

  test.each([[`format=invalid`], [`format=`]])(
    'should respond 400 for invalid format query parameter %s',
    async () => {
      const response = await request(app).get(
        `/v${version}/${username}?format=invalid`,
      );
      expect(response.statusCode).toBe(400);
      expect(response.body).toStrictEqual({
        error: "Query parameter 'format' must be 'nested' or undefined",
      });
    },
  );

  test('should respond 500 if an error is thrown', async () => {
    const fetchContributionsMock = jest.spyOn(
      fetchService,
      'fetchContributionsForQuery',
    );

    fetchContributionsMock.mockImplementation(() => {
      throw new Error('unexpected error');
    });

    const response = await request(app).get(`/v${version}/${username}`);

    expect(response.statusCode).toBe(500);
    expect(response.body).toStrictEqual({
      error: `Unable to fetch contribution data of '${username}': unexpected error.`,
    });
  });
});
