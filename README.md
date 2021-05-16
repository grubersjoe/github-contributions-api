# GitHub Contributions API v4

![CI](https://github.com/grubersjoe/github-contributions-api/actions/workflows/test.yml/badge.svg)

A simple API that returns number of GitHub contributions based on a users GitHub
profile. This API is used by
[React GitHub Calendar](https://github.com/grubersjoe/react-github-calendar)
(React component).

:warning: Results are cached for one hour!

## How to run

```shell
yarn
yarn start
```

For development:

```shell
yarn dev
```

## Usage

Send a GET request to the API in the following format:

```shell
https://github-contributions-api.jogruber.de/v4/GITHUB_USERNAME
```

And you will receive an object with _complete_ history of that user's
contributions (total per year and for each day):

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

You can return the results as an object keyed by year, month and day by using
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

### The `y` query parameter

Use the `y` (year) query parameter to retrieve the data for a specific year, a
set of years, the _last_ year (GitHub's default view), or the data for _all_
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

The responses are formally structured like this:

```typescript
type Level = 0 | 1 | 2 | 3 | 4;

interface Contribution {
  date: string;
  count: number;
  level: Level;
}

interface Response {
  total: {
    [year: number]: number;
    [year: string]: number; // 'lastYear'
  };
  contributions: Array<Contribution>;
}

interface NestedResponse {
  [year: number]: {
    [month: number]: {
      [day: number]: Contribution;
    };
    total: number;
  };
}
```
