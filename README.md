# GitHub Contributions API v4

[![CI](https://github.com/grubersjoe/github-contributions-api/actions/workflows/test.yml/badge.svg)](https://github.com/grubersjoe/github-contributions-api/actions/workflows/test.yml)

An API that returns a user's GitHub contribution data by scraping their profile.
It powers the
[React GitHub Calendar](https://github.com/grubersjoe/react-github-calendar)
component.

:warning: Results are cached for one hour.

## How to run

```shell
npm install
npm start
```

For development:

```shell
npm run dev
```

## Usage

Send a GET request to retrieve a user's complete contribution history, with
totals per year, the count and level of each day:

```shell
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME
```

```json
{
  "total": {
    "2020": 492,
    ...
  },
  "contributions": [
    {
      "date": "2020-01-01",
      "count": 0,
      "level": 0
    },
    {
      "date": "2020-01-02",
      "count": 9,
      "level": 4
    },
    {
      "date": "2020-01-03",
      "count": 5,
      "level": 2
    },
    ...
  ]
}
```

`level` ranges from 0 to 4 and is the intensity GitHub uses to shade the day in
its contribution calendar.

Add the `format=nested` query parameter to get the contributions as an object
keyed by year, month and day:

```shell
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME?format=nested
```

```json
{
  "total": {
    "2020": 492,
    ...
  },
  "contributions": {
    "2020": {
      "1": {
        "1": {
          "date": "2020-01-01",
          "count": 9,
          "level": 4
        },
        "2": {
          "date": "2020-01-02",
          "count": 0,
          "level": 0
        },
        "3": {
          "date": "2020-01-03",
          "count": 5,
          "level": 2
        },
        ...
      },
      ...
    },
    ...
  }
}
```

### Time range

Use the `y` query parameter to select a single year, multiple years, the last
year (GitHub's default view) or all years (the default). You can list up to 10
years per request:

```shell
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME?y=2020
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME?y=2016&y=2017
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME?y=last
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME?y=all # default
```

For example, `y=2016&y=2017` returns:

```json
{
  "total": {
    "2016": 249,
    "2017": 785
  },
  "contributions": [
    {
      "date": "2016-01-01",
      "count": 1,
      "level": 1
    },
    {
      "date": "2016-01-02",
      "count": 0,
      "level": 0
    },
    ...
  ]
}
```

### Response types

```typescript
type Contribution = {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

type Response = {
  total: {
    [year: number]: number
    [year: string]: number // 'lastYear'
  }
  contributions: Array<Contribution>
}

type NestedResponse = {
  total: {
    [year: number]: number
    [year: string]: number // 'lastYear'
  }
  contributions: {
    [year: number]: {
      [month: number]: {
        [day: number]: Contribution
      }
    }
  }
}

type ErrorResponse = {
  error: string
  issues?: Array<{
    code: string
    path: string
    message: string
  }>
}
```

### Rate limiting

All requests, including cached ones, are limited to 10 per 10 seconds per IP
address.

### Caching

Results are cached for one hour. The
[`age`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Age)
response header and the non-standard `x-cache: HIT | MISS` header indicate how
long ago the data was scraped and whether it came from the cache. To bypass the
cache, send a `cache-control: no-cache` request header. Please use this
responsibly and not per default for every request.
