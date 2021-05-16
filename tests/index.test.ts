import request from 'supertest';
import app from '../src';

import testData from './fixtures/grubersjoe-2018.json';
import testDataMultipleYears from './fixtures/grubersjoe-2017-2018.json';
import testDataNested from './fixtures/grubersjoe-2018-nested.json';

const version = 4;
const username = 'grubersjoe';

describe('Test the :username endpoint', () => {
  test('It should respond correct data for specific year', async () => {
    const response = await request(app).get(`/v${version}/${username}?y=2018`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(testData);
  });

  test('It should respond correct data for multiple years', async () => {
    const response = await request(app).get(
      `/v${version}/${username}?y=2017&y=2018`,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(testDataMultipleYears);
  });

  test('It should respond with data for last year', async () => {
    const response = await request(app).get(`/v${version}/${username}?y=last`);
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body.total)).toContain('lastYear');
    expect(typeof response.body.total.lastYear).toBe('number');
  });

  test('It should respond correct data for nested format', async () => {
    const response = await request(app).get(
      `/v${version}/${username}?y=2018&format=nested`,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual(testDataNested);
  });

  test('It should return empty response if no data is available', async () => {
    const response = await request(app).get(`/v${version}/${username}?y=1900`);
    expect(response.statusCode).toBe(200);
    expect(response.body).toStrictEqual({
      total: {},
      contributions: [],
    });
  });

  test('It should respond 400 for invalid y query parameter', async () => {
    const response = await request(app).get(
      `/v${version}/${username}?y=invalid`,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body).toStrictEqual({});
    expect(response.text).toBe(
      "Query parameter 'y' must be an integer, 'all' or 'last'",
    );
  });

  test('It should respond 400 for invalid format query parameter', async () => {
    const response = await request(app).get(
      `/v${version}/${username}?format=invalid`,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body).toStrictEqual({});
    expect(response.text).toBe(
      "Query parameter 'format' must be 'nested' or undefined",
    );
  });
});
