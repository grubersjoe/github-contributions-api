import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cache from 'memory-cache';
import cors from 'cors';

import { fetchDataForYears } from './fetch';

export interface Years {
  all: boolean;
  subset: Array<number>;
  withLastYear: boolean;
}

const app = express();

app.use(cors());
app.use(
  bodyParser.json({
    limit: '1mb',
  }),
);

app.get('/v3/:username', async (req, res, next) => {
  const { username } = req.params;
  const { format } = req.query;

  if (format !== undefined && format !== 'nested') {
    res
      .status(400)
      .send('Query parameter `format` must be `nested` or undefined');
  }

  let years: Years = {
    all: false,
    subset: [],
    withLastYear: false,
  };

  if (typeof req.query.y === 'string') {
    years.all = req.query.y === 'all';
    years.subset = [parseInt(req.query.y)].filter(n => !isNaN(n));
    years.withLastYear = req.query.y === 'lastYear';
  }

  if (Array.isArray(req.query.y)) {
    years.all = (req.query.y as Array<string>).includes('all');
    years.subset = (req.query.y as Array<string>)
      .map(y => parseInt(y))
      .filter(n => !isNaN(n));
    years.withLastYear = (req.query.y as Array<string>).includes('lastYear');
  }

  try {
    const key = `${username}-${JSON.stringify(years)}-${format}`;
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
