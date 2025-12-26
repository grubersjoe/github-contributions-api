import { fromURL } from 'cheerio'

import { Element, isText } from 'domhandler'
import { ReqQuery } from './api'

type Level = 0 | 1 | 2 | 3 | 4

type Contribution = {
  date: string
  count: number
  level: Level
}

export type Response = {
  total: {
    [year: number]: number
    [year: string]: number // 'lastYear;
  }
  contributions: Array<Contribution>
}

export type NestedResponse = {
  total: {
    [year: number]: number
    [year: string]: number // 'lastYear;
  }
  contributions: Record<number, Record<number, Record<number, Contribution>>> // [y][m][d]
}

/**
 * @throws UserNotFoundError
 */
async function scrapeYearLinks(username: string, years: 'all' | Array<number>) {
  try {
    const url = `https://github.com/${username}?action=show&controller=profiles&tab=contributions&user_id=${username}`

    const $ = await fromURL(url, {
      requestOptions: requestOptions(username),
    })

    return $('.js-year-link')
      .get()
      .map((a) => ({ year: parseInt($(a).text().trim()) }))
      .filter((link) => (years === 'all' ? true : years.includes(link.year)))
  } catch {
    throw new UserNotFoundError(username)
  }
}

/**
 * @throws Error if scraping of GitHub profile fails
 */
async function scrapeYear(
  username: string,
  year: number | 'lastYear',
  format?: 'nested',
): Promise<Response | NestedResponse> {
  const url =
    year === 'lastYear'
      ? `https://github.com/users/${username}/contributions`
      : `https://github.com/users/${username}/contributions?tab=overview&from=${year}-12-01&to=${year}-12-31`

  const $ = await fromURL(url, { requestOptions: requestOptions(username) })

  const days = $('.js-calendar-graph-table .ContributionCalendar-day')
  const sortedDays = days.get().sort((a, b) => {
    const dateA = a.attribs['data-date'] ?? ''
    const dateB = b.attribs['data-date'] ?? ''

    return dateA.localeCompare(dateB, 'en')
  })

  const totalMatch = /^([0-9,]+)\s/.exec(
    $('.js-yearly-contributions h2').text().trim(),
  )

  if (!totalMatch) {
    throw Error('Unable to parse total contributions count.')
  }

  const total = parseInt(totalMatch[0].replace(/,/g, ''))

  // Required for contribution count
  const tooltipsByDayId = $('.js-calendar-graph tool-tip')
    .toArray()
    .reduce<Record<string, Element>>((map, elem) => {
      map[elem.attribs.for] = elem
      return map
    }, {})

  const response = {
    total: {
      [year]: total,
    },
    contributions: {},
  }

  if (format === 'nested') {
    return sortedDays.reduce<NestedResponse>((data, day) => {
      const { date, contribution } = parseDay(day, tooltipsByDayId)
      const [y, m, d] = date

      data.contributions[y] ??= {}
      data.contributions[y][m] ??= {}
      data.contributions[y][m][d] = contribution

      return data
    }, response)
  }

  return {
    ...response,
    contributions: sortedDays.map(
      (day) => parseDay(day, tooltipsByDayId).contribution,
      tooltipsByDayId,
    ),
  }
}

const parseDay = (day: Element, tooltipsByDayId: Record<string, Element>) => {
  const attr = {
    id: day.attribs.id,
    date: day.attribs['data-date'],
    level: day.attribs['data-level'],
  }

  if (!attr.date) {
    throw Error('Unable to parse contribution date attribute.')
  }

  if (!attr.level) {
    throw Error('Unable to parse contribution level attribute.')
  }

  let count = 0

  const text = tooltipsByDayId[attr.id].firstChild
  if (text && isText(text)) {
    const countMatch = /^\d+/.exec(text.data.trim())
    if (countMatch) {
      count = parseInt(countMatch[0])
    }
  }

  const level = parseInt(attr.level) as Level

  if (isNaN(count)) {
    throw Error('Unable to parse contribution count.')
  }

  if (isNaN(level)) {
    throw Error('Unable to parse contribution level.')
  }

  const contribution = {
    date: attr.date,
    count,
    level,
  } satisfies Contribution

  return {
    date: attr.date.split('-').map((d: string) => parseInt(d)),
    contribution,
  }
}

/**
 * @throws UserNotFoundError
 */
export async function scrapeContributions(
  username: string,
  query: ReqQuery,
): Promise<Response | NestedResponse> {
  let requests = []

  if (query.y === 'last') {
    requests.push(scrapeYear(username, 'lastYear', query.format))
  } else {
    const yearLinks = await scrapeYearLinks(username, query.y)
    requests = yearLinks.map((link) =>
      scrapeYear(username, link.year, query.format),
    )
  }

  return Promise.all(requests).then((contributions) => {
    if (query.format === 'nested') {
      return (contributions as Array<NestedResponse>).reduce(
        (resp, curr) => ({
          total: { ...resp.total, ...curr.total },
          contributions: { ...resp.contributions, ...curr.contributions },
        }),
        {
          total: {},
          contributions: {},
        },
      )
    }

    return (contributions as Array<Response>).reduce(
      (resp, curr) => {
        return {
          total: { ...resp.total, ...curr.total },
          contributions: [...resp.contributions, ...curr.contributions],
        }
      },
      {
        total: {},
        contributions: [],
      },
    )
  })
}

const requestOptions = (username: string) => ({
  method: 'GET',
  headers: {
    referer: `https://github.com/${username}`,
    'x-requested-with': 'XMLHttpRequest',
  },
})

export class UserNotFoundError extends Error {
  constructor(username: string) {
    super(`User "${username}" not found.`)
  }
}
