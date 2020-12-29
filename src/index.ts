import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cache from 'memory-cache';
import cors from 'cors';

import { fetchDataForYears } from './fetch';

const app = express();

app.use(cors());
app.use(
  bodyParser.json({
    limit: '1mb',
  }),
);

app.get('/v1/:username', async (req, res, next) => {
  const { username } = req.params;
  const { format, lastYear } = req.query;

  if (format !== undefined && format !== 'nested') {
    res
      .status(400)
      .send('Query parameter `format` must be `nested` or undefined');
  }

  let years: number[] | undefined;

  if (typeof req.query.y === 'string') {
    years = [parseInt(req.query.y)].filter(n => !isNaN(n));
  }

  if (Array.isArray(req.query.y)) {
    years = (req.query.y as string[])
      .map(y => parseInt(y))
      .filter(n => !isNaN(n));
  }

  // If years is not set, all years are fetched anyway
  if (lastYear === 'true' && years) {
    const currentYear = new Date().getUTCFullYear();

    if (!years.includes(currentYear)) {
      years.push(currentYear);
    }

    if (!years.includes(currentYear - 1)) {
      years.push(currentYear - 1);
    }
  }

  try {
    const key = `${username}-${years ? years.sort().join('-') : ''}-${format}`;
    const cached = cache.get(key);

    if (cached !== null) {
      return res.json(cached);
    }

    const data = await fetchDataForYears(
      username,
      years,
      format as 'nested' | undefined,
    );

    cache.put(key, data, 1000 * 3600); // Store for an hour

    res.json(data);
  } catch (err) {
    console.error(err);
    next(
      new Error(`Fetching profile of ${username} has failed: ${err.message}`),
    );
  }
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).send({
    error: err.message,
  });
});

app.listen(process.env.PORT ?? 8080, () =>
  console.log(
    `Server listening on http://localhost:${process.env.PORT || 8080}`,
  ),
);
