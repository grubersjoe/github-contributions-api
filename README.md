# GitHub Contributions API v3

A simple API that returns number of Github contributions based on a users Github
profile. This API is used by
[React GitHub Calendar](https://github.com/grubersjoe/react-github-calendar)
(React component).

:warning: Results are cached for one hour!

## How to run

```
yarn
yarn start
```

## Example

Send a request to the API in the following format:

```
https://ancient-butterfly.herokuapp.com/v3/GITHUB_USERNAME?y=all
```

And you will receive an object with history of that user's contributions (total
per year and for every day):

```json
{
  "years": {
    "2020": 492,
    ...
  },
  "contributions": [
    {
      "date": "2020-03-31",
      "count": 0,
      "level": 0
    },
    {
      "date": "2020-04-01",
      "count": 9,
      "level": 4
    },
    {
      "date": "2020-04-02",
      "count": 5,
      "level": 2
    },
    ...
  ]
}
```

You can return the results as an object keyed by year, month and day by using
the `format=nested` query paramater:

```
https://ancient-butterfly.herokuapp.com/v3/GITHUB_USERNAME?y=all&format=nested
```

```json
{
  "2020": {
    "4": {
      "1": {
        "date": "2020-04-01",
        "count": 9,
        "level": 4
      },
      "2": {
        "date": "2020-04-02",
        "count": 5,
        "level": 2
      },
      "3": {
        "date": "2020-04-03",
        "count": 0,
        "level": 0
      },
      ...
    },
   ...
  }
}
```

By using the `y` query parameter you can either specify a set of years or
retrieve all contribution data when using `all` as value:

```
https://ancient-butterfly.herokuapp.com/v3/GITHUB_USERNAME?y=2016&y=2017
```

```json
{
  "years": {
    "2016": 249,
    "2017": 785,
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

Finally, you can retrieve the contributions of the last year (GitHub's default
calendar view) when using `lastYear` as `y` query parameter:

```
https://ancient-butterfly.herokuapp.com/v3/GITHUB_USERNAME?y=lastYear
```
