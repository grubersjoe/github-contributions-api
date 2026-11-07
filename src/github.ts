import { CheerioRequestOptions, fromURL } from 'cheerio'
import { Element, isText } from 'domhandler'
import { errors } from 'undici'
import { ClientSafeError, HTTPError } from './errors'
import { ReqQuery } from './router'

type Level = 0 | 1 | 2 | 3 | 4

const isLevel = (n: number): n is Level => n >= 0 && n <= 4

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
  contributions: Contribution[]
}

export type NestedResponse = {
  total: {
    [year: number]: number
    [year: string]: number // 'lastYear;
  }
  contributions: Record<number, Record<number, Record<number, Contribution>>> // [y][m][d]
}

/**
 * @throws {HTTPError, ClientSafeError}
 */
export const scrapeContributions = async (
  username: string,
  query: ReqQuery,
): Promise<Response | NestedResponse> => {
  const years: (number | 'last')[] =
    query.y === 'all'
      ? await fetchAllYearsFor(username)
      : query.y === 'last'
        ? [query.y]
        : query.y

  if (query.format === 'nested') {
    const responses = await Promise.all(
      years.map((year) => scrapeYearNested(username, year)),
    )

    return responses.reduce<NestedResponse>(
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

  const responses = await Promise.all(
    years.map((year) => scrapeYear(username, year)),
  )

  return responses.reduce<Response>(
    (resp, curr) => ({
      total: { ...resp.total, ...curr.total },
      contributions: [...resp.contributions, ...curr.contributions],
    }),
    {
      total: {},
      contributions: [],
    },
  )
}

/**
 * @throws {HTTPError, ClientSafeError}
 */
const scrapeYear = async (
  username: string,
  year: number | 'last',
): Promise<Response> => {
  const { total, days, tooltipsByDayId } = await scrapeCalendar(username, year)

  return {
    total,
    contributions: days.map(
      (day) => parseDay(day, tooltipsByDayId).contribution,
    ),
  }
}

/**
 * @throws {HTTPError, ClientSafeError}
 */
const scrapeYearNested = async (
  username: string,
  year: number | 'last',
): Promise<NestedResponse> => {
  const { total, days, tooltipsByDayId } = await scrapeCalendar(username, year)

  return days.reduce<NestedResponse>(
    (data, day) => {
      const { date, contribution } = parseDay(day, tooltipsByDayId)
      const [y, m, d] = date

      data.contributions[y] ??= {}
      data.contributions[y][m] ??= {}
      data.contributions[y][m][d] = contribution

      return data
    },
    { total, contributions: {} },
  )
}

/**
 * @throws {HTTPError, ClientSafeError}
 */
const scrapeCalendar = async (username: string, year: number | 'last') => {
  const url =
    year === 'last'
      ? `https://github.com/users/${username}/contributions`
      : `https://github.com/users/${username}/contributions?tab=overview&from=${year}-12-01&to=${year}-12-31`

  const $ = await fromURL(url, requestOptions(username)).catch((err) =>
    onFetchError(err, username),
  )

  const days = $('.js-calendar-graph-table .ContributionCalendar-day')

  // GitHub always renders the full calendar, even for years without activity
  if (days.length === 0) {
    throw new Error('Failed parsing contribution days')
  }

  const sortedDays = days.get().toSorted((a, b) => {
    const dateA = a.attribs['data-date'] ?? ''
    const dateB = b.attribs['data-date'] ?? ''

    return dateA.localeCompare(dateB, 'en')
  })

  const totalMatch = /^([0-9,]+)\s/.exec(
    $('.js-yearly-contributions h2').text().trim(),
  )

  if (!totalMatch) {
    throw new Error('Failed parsing total contributions count')
  }

  const total = parseInt(totalMatch[0].replaceAll(',', ''))

  // Required for contribution count
  const tooltipsByDayId = $('.js-calendar-graph tool-tip')
    .toArray()
    .reduce<Record<string, Element>>((map, elem) => {
      map[elem.attribs.for] = elem
      return map
    }, {})

  return {
    total: { [year === 'last' ? 'lastYear' : year]: total },
    days: sortedDays,
    tooltipsByDayId,
  }
}

const parseDay = (day: Element, tooltipsByDayId: Record<string, Element>) => {
  const attr = {
    id: day.attribs.id,
    date: day.attribs['data-date'],
    level: day.attribs['data-level'],
  }

  if (!attr.date) {
    throw new Error('Failed parsing contribution date attribute')
  }

  if (!attr.level) {
    throw new Error('Failed parsing contribution level attribute')
  }

  let count = 0

  const text = tooltipsByDayId[attr.id].firstChild
  if (text && isText(text)) {
    const countMatch = /^\d+/.exec(text.data.trim())
    if (countMatch) {
      count = parseInt(countMatch[0])
    }
  }

  if (isNaN(count)) {
    throw new Error('Failed parsing contribution count')
  }

  const level = parseInt(attr.level)

  if (!isLevel(level)) {
    throw new Error('Failed parsing contribution level')
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
 * @throws {HTTPError, ClientSafeError}
 */
export const fetchAllYearsFor = async (username: string) => {
  const url = `https://github.com/${username}?action=show&controller=profiles&tab=contributions&user_id=${username}`
  const $ = await fromURL(url, requestOptions(username)).catch((err) =>
    onFetchError(err, username),
  )

  return $('.js-year-link')
    .get()
    .map((a) => parseInt($(a).text().trim()))
}

const requestOptions = (username: string): CheerioRequestOptions => ({
  requestOptions: {
    method: 'GET',
    headers: {
      'accept': 'text/html',
      'referer': `https://github.com/${username}`,
      'x-requested-with': 'XMLHttpRequest',
    },
  },
})

/**
 * @throws {HTTPError, ClientSafeError}
 */
const onFetchError = (error: unknown, username: string) => {
  if (error instanceof errors.ResponseError)
    switch (error.statusCode) {
      case 404:
        throw new HTTPError(404, `GitHub user "${username}" not found.`)
      case 429: {
        const retryAfter = getUndiciHeader(error.headers, 'retry-after')
        throw new HTTPError(
          429,
          'GitHub: Too many requests.',
          retryAfter ? { 'retry-after': retryAfter } : undefined,
        )
      }
      case 502:
        throw new HTTPError(502, 'GitHub: Bad gateway.')
      case 503:
        throw new HTTPError(503, 'GitHub: Service unavailable.')
      case 504:
        throw new HTTPError(504, 'GitHub: Gateway timeout.')
    }

  throw new ClientSafeError(`Failed to scrape contributions of "${username}"`)
}

const getUndiciHeader = (
  headers: errors.ResponseError['headers'],
  name: string,
): string | undefined => {
  if (Array.isArray(headers)) {
    for (let i = 0; i < headers.length; i += 2) {
      if (headers[i]?.toLowerCase() === name.toLowerCase()) {
        return headers[i + 1]
      }
    }

    return undefined
  }

  return headers?.[name.toLowerCase()]?.toString()
}
