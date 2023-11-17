import cheerio from 'cheerio';

import { ParsedQuery } from '.';

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
async function scrapeYearLinks(username: string, query: ParsedQuery) {
  const page = await fetch(`https://github.com/${username}`);
  const $ = cheerio.load(await page.text());

  const yearLinks = $('.js-year-link').get();

  if (yearLinks.length === 0) {
    throw new UserNotFoundError(username);
  }

  return yearLinks
    .map((a) => {
      const $a = $(a);
      const href = $a.attr('href');

      if (!href) {
        throw Error('Unable to parse year link.');
      }

      return {
        year: parseInt($a.text().trim()),
        href,
      };
    })
    .filter((link) =>
      query.fetchAll ? true : query.years.includes(link.year),
    );
}

/**
 * @throws Error if scraping of GitHub profile fails
 */
async function scrapeContributionsForYear(
  year: Year,
  url: string,
  format?: 'nested',
): Promise<Response | NestedResponse> {
  const page = await fetch(`https://github.com${url}`);

  const $ = cheerio.load(await page.text());
  const $days = $('.js-calendar-graph-table .ContributionCalendar-day');

  const sortedDays: Array<Element> = $days.get().sort((a, b) => {
    const dateA = $(a).attr('data-date') ?? '';
    const dateB = $(b).attr('data-date') ?? '';

    return dateA.localeCompare(dateB, 'en');
  });

  const totalMatch = $('.js-yearly-contributions h2')
    .text()
    .trim()
    .match(/^([0-9,]+)\s/);

  if (!totalMatch) {
    throw Error('Unable to parse total contributions count.');
  }

  const total = parseInt(totalMatch[0].replace(/,/g, ''));

  const parseDay = (day: Node) => {
    const $day = $(day);
    const attr = {
      date: $day.attr('data-date'),
      level: $day.attr('data-level'),
    };

    if (!attr.date) {
      throw Error('Unable to parse date attribute');
    }

    if (!attr.level) {
      throw Error('Unable to parse level attribute');
    }

    const countMatch = $day.text().trim().match(/^\d+/);

    if (!countMatch) {
      throw Error('Unable to parse contribution count')
    }

    const count = parseInt(countMatch[0]);
    const level = parseInt(attr.level) as Level;

    if (isNaN(count)) {
      throw Error('Unable to parse contribution count for day');
    }

    if (isNaN(level)) {
      throw Error('Unable to parse contribution level for day');
    }

    const contribution: Contribution = {
      date: attr.date,
      count,
      level,
    };

    return {
      date: attr.date.split('-').map((d) => parseInt(d)),
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
    return sortedDays.reduce<NestedResponse>((data, day: Node) => {
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
    contributions: sortedDays.map((day) => parseDay(day).contribution),
  };
}

/**
 * @throws UserNotFoundError
 */
export async function scrapeGitHubContributions(
  username: string,
  query: ParsedQuery,
): Promise<Response | NestedResponse> {
  const yearLinks = await scrapeYearLinks(username, query);
  const contributionsForYear = yearLinks.map((link) =>
    scrapeContributionsForYear(link.year, link.href, query.format),
  );

  if (query.lastYear) {
    contributionsForYear.push(
      scrapeContributionsForYear('lastYear', `/${username}`, query.format),
    );
  }

  return Promise.all(contributionsForYear).then((contributions) => {
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

export class UserNotFoundError extends Error {
  constructor(username: string) {
    super(`User '${username}' not found`);
  }
}
