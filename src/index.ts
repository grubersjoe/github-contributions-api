import express, { ErrorRequestHandler } from 'express';
import cache from 'memory-cache';
import cors from 'cors';
import compression from 'compression';

import {
  NestedResponse as ApiNestedResponse,
  Response as ApiResponse,
  scrapeGitHubContributions,
  UserNotFoundError,
} from './scrape';

export interface ParsedQuery {
  years: Array<number>;
  fetchAll: boolean;
  lastYear: boolean;
  format: QueryParams['format'];
}

interface Params {
  username: string;
}

interface QueryParams {
  y?: string | Array<string>;
  format?: 'nested';
}

type Request = express.Request<
  Params,
  ApiResponse | ApiNestedResponse | { error: string },
  {},
  QueryParams
>;

const app = express();

app.use(cors());
app.use(compression());

app.get('/v4/:username', async (req: Request, res, next) => {
  const { username } = req.params;

  if (req.query.format && req.query.format !== 'nested') {
    return res.status(400).send({
      error: "Query parameter 'format' must be 'nested' or undefined",
    });
  }

  const years =
    req.query.y != null
      ? typeof req.query.y === 'string'
        ? [req.query.y]
        : req.query.y
      : [];

  if (years.some((y) => !/^\d+$/.test(y) && y !== 'all' && y !== 'last')) {
    return res.status(400).send({
      error: "Query parameter 'y' must be an integer, 'all' or 'last'",
    });
  }

  const query: ParsedQuery = {
    years: years.map((y) => parseInt(y)).filter(isFinite),
    fetchAll: years.includes('all') || years.length === 0,
    lastYear: years.includes('last'),
    format: req.query.format,
  };

  const key = `${username}-${JSON.stringify(query)}`;
  const cached = cache.get(key);

  if (cached !== null) {
    return res.json(cached);
  }

  try {
    const response = await scrapeGitHubContributions(username, query);
    cache.put(key, response, 1000 * 3600); // Store for an hour

    return res.json(response);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return res.status(404).send({
        error: error.message,
      });
    }

    next(
      new Error(
        `Error scraping contribution data of '${username}': ${
          error instanceof Error ? error.message : 'Unknown error.'
        }`,
      ),
    );
  }
});

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  res.status(error.statusCode ?? 500).json({
    error: error.message,
  });
};

// To override the default Express.js error handler this needs to be last!
// The order of middleware does matter.
app.use(errorHandler);

export default app;
