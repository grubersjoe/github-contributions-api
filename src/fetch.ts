import cheerio from 'cheerio';
import fetch from 'node-fetch';
import _ from 'lodash';

const error = (username?: string) =>
  new Error(`
    Unable to retrieve contribution data${
      username ? ` for user ${username}` : ''
    }.
    Please open an issue here: https://github.com/grubersjoe/github-contributions-api/issues.
  `);

async function fetchYearLinks(username: string, years?: number[]) {
  const data = await fetch(`https://github.com/${username}`);
  const $ = cheerio.load(await data.text());

  return $('.js-year-link')
    .get()
    .map(a => {
      const $a = $(a);
      const href = $a.attr('href');

      if (!href) {
        throw error(username);
      }

      return { year: parseInt($a.text().trim()), href };
    })
    .filter(link => (years ? years.includes(link.year) : true));
}

async function fetchDataForYear(year: number, url: string, format?: 'nested') {
  const data = await fetch(`https://github.com${url}`);
  const $ = cheerio.load(await data.text());

  const $days = $('rect.day');

  const contribCountMatch = $('.js-yearly-contributions h2')
    .text()
    .trim()
    .match(/^([0-9,]+)\s/);

  if (!contribCountMatch) {
    throw error();
  }

  const contribCount = parseInt(contribCountMatch[0].replace(/,/g, ''));

  return {
    year,
    total: contribCount,
    contributions: (() => {
      const parseDay = (day: Node) => {
        const $day = $(day);

        const attr = {
          date: $day.attr('data-date'),
          count: $day.attr('data-count'),
          fill: $day.attr('fill'),
        };

        if (!attr.count || !attr.date || !attr.fill) {
          throw error();
        }

        const date = attr.date.split('-').map(d => parseInt(d));
        const count = parseInt(attr.count);

        if (isNaN(count)) {
          throw error();
        }

        const colorMatch = attr.fill.match(
          /color-calendar-graph-day-L(\d+)-bg/,
        );

        const intensity =
          colorMatch && colorMatch[1] ? parseInt(colorMatch[1]) : 0;

        const value = {
          date: attr.date,
          count,
          intensity,
        };

        return { date, value };
      };

      if (format !== 'nested') {
        return $days.get().map(day => parseDay(day).value);
      }

      return $days.get().reduce((o, day: Node) => {
        const { date, value } = parseDay(day);
        const [_, m, d] = date;

        if (!o[m]) o[m] = {};
        o[m][d] = value;

        return o;
      }, {});
    })(),
  };
}

export async function fetchDataForYears(
  username: string,
  years?: number[],
  format?: 'nested',
) {
  const yearLinks = await fetchYearLinks(username, years);

  return Promise.all(
    yearLinks.map(link => fetchDataForYear(link.year, link.href, format)),
  ).then(resp =>
    format !== 'nested'
      ? resp
      : resp.reduce(
          (acc, curr) => ({
            ...acc,
            [curr.year]: {
              ...curr.contributions,
              total: curr.total,
            },
          }),
          {},
        ),
  );
}
