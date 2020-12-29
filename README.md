# GitHub Contributions API 

A simple API that returns number of Github contributions based on a users Github profile. This API is used for generating an image of user contributions [in this site](https://github-contributions.now.sh/)

## How to run

Install the packages using [NPM](https://nodejs.org/en/):

```
npm install
npm start
```

## Example

Send a request to the API in the following format:

```
https://grubersjoe-github-contributions-api.now.sh/v1/GITHUB_USERNAME
```

And you will receive an object with history of that user's contributions:

```json
{
  ...
  "contributions": [
    {
      "date": "2018-04-30",
      "count": 2,
      "color": "#c6e48b"
    },
    {
      "date": "2018-04-29",
      "count": 29,
      "color": "#239a3b"
    },
    ...
  ]
}
```

You can return the results as an object keyed by year, month and day by using the `format=nested` query param:

```
https://github-contributions-api.now.sh/v1/GITHUB_USERNAME?format=nested
```

```json
{
  ...
  "contributions": {
     "2018": {
       "4": {
         "29": {
           "date": "2018-04-29",
           "count": 29,
           "color": "#239a3b"
         },
         "39": {
           "date": "2018-04-30",
           "count": 2,
           "color": "#c6e48b"
         }
       },
    },
    ...
  }
}
```
