# GitHub Contributions API v4

[![CI](https://github.com/grubersjoe/github-contributions-api/actions/workflows/test.yml/badge.svg)](https://github.com/grubersjoe/github-contributions-api/actions/workflows/test.yml)

An API that returns the number of GitHub contributions by scraping a user's
GitHub profile. This API is used by
[React GitHub Calendar](https://github.com/grubersjoe/react-github-calendar)
(React component).

:warning: Results are cached for one hour!

<a href="https://www.buymeacoffee.com/grubersjoe">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 40px;" >
</a>

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

Send a GET request to the API in the following format:

```shell
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME
```

And you will receive the complete GitHub contribution history of that user (total per year and for each day):

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

You can also request the data as an object keyed by year, month and day by using
the `format=nested` query parameter:

```shell
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME?format=nested
```

```json
{
  "2020": {
    "1": {
      "1": {
        "date": "2020-01-01",
        "count": 9,
        "level": 4
      },
      "2": {
        "date": "2020-01-02",
        "count": 5,
        "level": 2
      },
      "3": {
        "date": "2020-01-03",
        "count": 0,
        "level": 0
      },
      ...
    },
   ...
  }
}
```

### Time selection

Use the `y` query parameter to retrieve the data for a specific year, a
set of years, the last year (GitHub's default view), or the data for all
years (default when `y` parameter is omitted):

```shell
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME?y=2020
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME?y=2016&y=2017
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME?y=last
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME?y=all # default
```

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

### Response interface

The responses are structured like this:

```typescript
interface Contribution {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

interface Response {
  total: {
    [year: number]: number
    [year: string]: number // 'lastYear'
  }
  contributions: Array<Contribution>
}

interface NestedResponse {
  total: {
    [year: number]: number
    [year: string]: number // 'lastYear;
  }
  contributions: {
    [year: number]: {
      [month: number]: {
        [day: number]: Contribution
      }
    }
  }
}
```

### Caching

Results are cached for one hour. The API returns the [`age`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Age) and the non-standard `x-cache: HIT | MISS` headers to provide more information about when the data was last scraped and if the cache was hit.

You can enforce fresh data using the `cache-control: no-cache` header in the request, but please use this responsibly and not per default for every request.
