import cheerio from 'cheerio';
import fetch from 'node-fetch';

import { ParsedQuery } from '.';
import { UserNotFoundError } from './errors';

type Level = 0 | 1 | 2 | 3 | 4;
type Year = number | 'lastYear';

interface Contribution {
  date: string;
  count: number;
  level: Level;
}

export interface Response {
  total: {
    [year: number]: number;
    [year: string]: number; // 'lastYear;
  };
  contributions: Array<Contribution>;
}

export interface NestedResponse {
  total: {
    [year: number]: number;
    [year: string]: number; // 'lastYear;
  };
  contributions: {
    [year: number]: {
      [month: number]: {
        [day: number]: Contribution;
      };
    };
  };
}

/**
 * @throws Error
 * @throws UserNotFoundError
 */
async function fetchYearLinks(username: string, query: ParsedQuery) {
  const data = await fetch(`https://github.com/${username}`);
  const $ = cheerio.load(await data.text());

  const yearLinks = $('.js-year-link').get();

  if (yearLinks.length === 0) {
    throw new UserNotFoundError(username);
  }

  return yearLinks
    .map(a => {
      const $a = $(a);
      const href = $a.attr('href');

      if (!href) {
        throw Error('Unable to fetch year link.');
      }

      return {
        year: parseInt($a.text().trim(), 10),
        href,
      };
    })
    .filter(link => (query.fetchAll ? true : query.years.includes(link.year)));
}

/**
 * @throws Error if scraping of GitHub profile fails
 */
async function fetchContributionsForYear(
  year: Year,
  url: string,
  format?: 'nested',
): Promise<Response | NestedResponse> {
  const data = await fetch(`https://github.com${url}`);

  const $ = cheerio.load(await data.text());
  const $days = $('.js-calendar-graph-svg .ContributionCalendar-day');

  const totalMatch = $('.js-yearly-contributions h2')
    .text()
    .trim()
    .match(/^([0-9,]+)\s/);

  if (!totalMatch) {
    throw Error('Unable to fetch total contributions count.');
  }

  const total = parseInt(totalMatch[0].replace(/,/g, ''), 10);

  const parseDay = (day: Node) => {
    const $day = $(day);
    const attr = {
      date: $day.attr('data-date'),
      count: $day.attr('data-count'),
      level: $day.attr('data-level'),
    };

    if (!attr.count || !attr.date || !attr.level) {
      throw Error('Unable to fetch contribution data for day.');
    }

    const count = parseInt(attr.count, 10);
    const level = parseInt(attr.level, 10) as Level;

    if (isNaN(count)) {
      throw Error('Unable to parse contribution count for day.');
    }

    if (isNaN(level)) {
      throw Error('Unable to parse contribution level for day.');
    }

    const contribution: Contribution = {
      date: attr.date,
      count,
      level,
    };

    return {
      date: attr.date.split('-').map(d => parseInt(d, 10)),
      contribution,
    };
  };

  const response = {
    total: {
      [year]: total,
    },
    contributions: {},
  };

  if (format === 'nested') {
    return $days.get().reduce<NestedResponse>((data, day: Node) => {
      const { date, contribution } = parseDay(day);
      const [y, m, d] = date;

      if (!data.contributions[y]) data.contributions[y] = {};
      if (!data.contributions[y][m]) data.contributions[y][m] = {};

      data.contributions[y][m][d] = contribution;

      return data;
    }, response);
  }

  return {
    ...response,
    contributions: $days.get().map(day => parseDay(day).contribution),
  };
}

/**
 * @throws UserNotFoundError
 */
export async function fetchContributionsForQuery(
  username: string,
  query: ParsedQuery,
): Promise<Response | NestedResponse> {
  const yearLinks = await fetchYearLinks(username, query);
  const contributionsForYear = yearLinks.map(link =>
    fetchContributionsForYear(link.year, link.href, query.format),
  );

  if (query.lastYear) {
    contributionsForYear.push(
      fetchContributionsForYear('lastYear', `/${username}`, query.format),
    );
  }
  return Promise.all(contributionsForYear).then(contributions => {
    if (query.format === 'nested') {
      return (contributions as Array<NestedResponse>).reduce(
        (acc, curr) => ({
          total: { ...acc.total, ...curr.total },
          contributions: { ...acc.contributions, ...curr.contributions },
        }),
        {
          total: {},
          contributions: {},
        },
      );
    }

    return (contributions as Array<Response>).reduce(
      (acc, curr) => ({
        total: { ...acc.total, ...curr.total },
        contributions: [...acc.contributions, ...curr.contributions],
      }),
      {
        total: {},
        contributions: [],
      },
    );
  });
}
