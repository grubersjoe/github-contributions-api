import cheerio from 'cheerio';
import fetch from 'node-fetch';
import { Years } from '.';

type Year = number | 'lastYear';

interface Contribution {
  date: string;
  count: number;
  level: number;
}

interface YearData {
  years: {
    [year: number]: number;
    [year: string]: number; // lastYear
  };
  contributions: Array<Contribution>;
}

interface NestedYearData {
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

async function fetchYearLinks(username: string, years: Years) {
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
    .filter(link => (years.all ? true : years.subset.includes(link.year)));
}

async function fetchDataForYear(
  year: Year,
  url: string,
  format?: 'nested',
): Promise<YearData | NestedYearData> {
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
    const level = parseInt(attr.level);

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
    return $days.get().reduce<NestedYearData>((o, day: Node) => {
      const { date, contribution } = parseDay(day);
      const [y, m, d] = date;

      if (!o[y]) o[y] = { total };
      if (!o[y][m]) o[y][m] = {};

      o[y][m][d] = contribution;

      return o;
    }, {});
  }

  return {
    years: {
      [year]: total,
    },
    contributions: $days.get().map(day => parseDay(day).contribution),
  };
}

export async function fetchDataForYears(
  username: string,
  years: Years,
  format?: 'nested',
) {
  const yearLinks = await fetchYearLinks(username, years);
  const yearDataPromises = yearLinks.map(link =>
    fetchDataForYear(link.year, link.href, format),
  );

  if (years.withLastYear) {
    yearDataPromises.push(fetchDataForYear('lastYear', `/${username}`, format));
  }

  return Promise.all(yearDataPromises).then(yearData => {
    if (format === 'nested') {
      return yearData.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    }

    return (yearData as Array<YearData>).reduce(
      (acc, curr) => ({
        years: { ...acc.years, ...curr.years },
        contributions: [...acc.contributions, ...curr.contributions],
      }),
      {
        years: {},
        contributions: [],
      },
    );
  });
}
