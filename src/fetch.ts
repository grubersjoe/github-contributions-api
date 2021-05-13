import cheerio from 'cheerio';
import fetch from 'node-fetch';
import { ParsedQuery } from '.';

type Year = number | 'lastYear';
type Level = 0 | 1 | 2 | 3 | 4;

interface Contribution {
  date: string;
  count: number;
  level: Level;
}

interface Response {
  total: {
    [year: number]: number;
    [year: string]: number; // 'lastYear;
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

const generalError = (username?: string) =>
  new Error(`
    Unable to retrieve contribution data${
      username ? ` for user ${username}` : ''
    }.
    Please open an issue: https://github.com/grubersjoe/github-contributions-api/issues.
  `);

async function fetchYearLinks(username: string, query: ParsedQuery) {
  const data = await fetch(`https://github.com/${username}`);
  const $ = cheerio.load(await data.text());

  return $('.js-year-link')
    .get()
    .map(a => {
      const $a = $(a);
      const href = $a.attr('href');

      if (!href) {
        throw generalError(username);
      }

      return {
        year: parseInt($a.text().trim()),
        href,
      };
    })
    .filter(link => (query.allYears ? true : query.years.includes(link.year)));
}

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
    throw generalError();
  }

  const total = parseInt(totalMatch[0].replace(/,/g, ''));

  const parseDay = (day: Node) => {
    const $day = $(day);
    const attr = {
      date: $day.attr('data-date'),
      count: $day.attr('data-count'),
      level: $day.attr('data-level'),
    };

    if (!attr.count || !attr.date || !attr.level) {
      throw generalError();
    }

    const count = parseInt(attr.count);
    const level = parseInt(attr.level) as Level;

    if (isNaN(count) || isNaN(level)) {
      throw generalError();
    }

    const contribution: Contribution = {
      date: attr.date,
      count,
      level,
    };

    return {
      date: attr.date.split('-').map(d => parseInt(d)),
      contribution,
    };
  };

  if (format === 'nested') {
    return $days.get().reduce<NestedResponse>((data, day: Node) => {
      const { date, contribution } = parseDay(day);
      const [y, m, d] = date;

      if (!data[y]) data[y] = { total };
      if (!data[y][m]) data[y][m] = {};

      data[y][m][d] = contribution;

      return data;
    }, {});
  }

  return {
    total: {
      [year]: total,
    },
    contributions: $days.get().map(day => parseDay(day).contribution),
  };
}

export async function fetchContributionsForQuery(
  username: string,
  query: ParsedQuery,
) {
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
        (acc, curr) => ({ ...acc, ...curr }),
        {},
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
