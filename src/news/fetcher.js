const rss = require('./rss');
const forexfactory = require('./forexfactory');

const MOCK_NEWS = [
  {
    source: 'ForexFactory',
    sourceUrl: 'https://www.forexfactory.com/calendar',
    title: 'USD - Federal Reserve Interest Rate Decision',
    currency: 'USD',
    impact: 'High',
    time: new Date().toISOString(),
    actual: '5.50%',
    forecast: '5.50%',
    previous: '5.25%',
    description: 'The Federal Reserve announces rate hike of 25 basis points.',
  },
  {
    source: 'ForexFactory',
    sourceUrl: 'https://www.forexfactory.com/calendar',
    title: 'EUR - ECB Maintains Rates',
    currency: 'EUR',
    impact: 'High',
    time: new Date().toISOString(),
    actual: '4.50%',
    forecast: '4.50%',
    previous: '4.50%',
    description: 'European Central Bank keeps rates unchanged.',
  },
  {
    source: 'ForexFactory',
    sourceUrl: 'https://www.forexfactory.com/calendar',
    title: 'GBP - UK GDP Beats Expectations',
    currency: 'GBP',
    impact: 'High',
    time: new Date().toISOString(),
    actual: '0.3%',
    forecast: '0.1%',
    previous: '-0.1%',
    description: 'UK GDP comes in higher than expected.',
  },
  {
    source: 'ForexFactory',
    sourceUrl: 'https://www.forexfactory.com/calendar',
    title: 'USD - Non-Farm Payrolls Strong',
    currency: 'USD',
    impact: 'High',
    time: new Date().toISOString(),
    actual: '250K',
    forecast: '180K',
    previous: '180K',
    description: 'US employment data beats expectations.',
  },
  {
    source: 'ForexFactory',
    sourceUrl: 'https://www.forexfactory.com/calendar',
    title: 'JPY - Inflation Rises',
    currency: 'JPY',
    impact: 'Medium',
    time: new Date().toISOString(),
    actual: '3.2%',
    forecast: '2.9%',
    previous: '2.8%',
    description: 'Japanese CPI comes in higher than expected.',
  },
  {
    source: 'Bloomberg',
    sourceUrl: 'https://bloomberg.com',
    title: 'Fed Signals Potential Rate Cuts in 2024 as Inflation Cools',
    description: 'Federal Reserve officials indicated they may begin cutting interest rates this year as inflation continues to moderate toward their 2% target.',
    publishedAt: new Date().toISOString(),
    impact: 'High',
  },
  {
    source: 'Reuters',
    sourceUrl: 'https://reuters.com',
    title: 'ECB Maintains Hawkish Stance Despite Economic Slowdown',
    description: 'The European Central Bank kept interest rates unchanged and emphasized its commitment to fighting inflation despite signs of economic weakness.',
    publishedAt: new Date().toISOString(),
    impact: 'Medium',
  },
  {
    source: 'ForexFactory',
    sourceUrl: 'https://www.forexfactory.com/calendar',
    title: 'AUD - Retail Sales Miss',
    currency: 'AUD',
    impact: 'Medium',
    time: new Date().toISOString(),
    actual: '0.1%',
    forecast: '0.3%',
    previous: '0.5%',
    description: 'Australian retail sales come in lower than expected.',
  },
];

async function fetchAllNews(options = {}) {
  const { sources = ['forexfactory', 'bloomberg', 'reuters', 'investing'], limit = 50 } = options;
  const results = [];

  const fetchPromises = [];

  if (sources.includes('forexfactory')) {
    fetchPromises.push(
      rss.fetchForexFactoryNews()
        .then(events => {
          if (events.length === 0) {
            const mockFx = MOCK_NEWS.filter(n => n.source === 'ForexFactory');
            results.push(...mockFx);
          } else {
            results.push(...events);
          }
        })
        .catch(() => {
          const mockFx = MOCK_NEWS.filter(n => n.source === 'ForexFactory');
          results.push(...mockFx);
        })
    );
  }

  if (sources.includes('bloomberg')) {
    fetchPromises.push(
      rss.fetchBloombergNews()
        .then(articles => {
          if (articles.length === 0) {
            const mockBg = MOCK_NEWS.filter(n => n.source === 'Bloomberg');
            results.push(...mockBg);
          } else {
            results.push(...articles);
          }
        })
        .catch(() => {
          const mockBg = MOCK_NEWS.filter(n => n.source === 'Bloomberg');
          results.push(...mockBg);
        })
    );
  }

  if (sources.includes('reuters')) {
    fetchPromises.push(
      rss.fetchReutersNews()
        .then(articles => {
          if (articles.length === 0) {
            const mockRt = MOCK_NEWS.filter(n => n.source === 'Reuters');
            results.push(...mockRt);
          } else {
            results.push(...articles);
          }
        })
        .catch(() => {
          const mockRt = MOCK_NEWS.filter(n => n.source === 'Reuters');
          results.push(...mockRt);
        })
    );
  }

  if (sources.includes('investing')) {
    fetchPromises.push(
      rss.fetchInvestingNews()
        .then(articles => results.push(...articles))
        .catch(() => {})
    );
  }

  await Promise.allSettled(fetchPromises);

  if (results.length === 0) {
    results.push(...MOCK_NEWS);
  }

  const sortedResults = results
    .filter(item => item.title && item.title.length > 0)
    .sort((a, b) => {
      const timeA = a.time || a.publishedAt || '1970-01-01';
      const timeB = b.time || b.publishedAt || '1970-01-01';
      return new Date(timeB) - new Date(timeA);
    })
    .slice(0, limit);

  return sortedResults;
}

async function fetchHighImpactNews() {
  const allNews = await fetchAllNews({ limit: 100 });
  
  return allNews.filter(item => {
    if (item.impact === 'High' || item.impact === 3) return true;
    if (item.title) {
      const highImpactKeywords = [
        'fed', 'federal reserve', 'interest rate', 'rate decision',
        'gdp', 'unemployment', 'nfp', 'nonfarm payrolls',
        'inflation', 'cpi', 'pce', 'gdp',
        'ECB', 'BOJ', 'BOE', 'central bank',
        'trade war', 'tariff', 'sanction',
      ];
      const titleLower = item.title.toLowerCase();
      return highImpactKeywords.some(keyword => titleLower.includes(keyword));
    }
    return false;
  });
}

async function fetchByCurrency(currency) {
  const allNews = await fetchAllNews({ limit: 100 });
  
  const currencyMap = {
    'USD': ['usd', 'dollar', 'america', 'united states'],
    'EUR': ['eur', 'euro', 'europe', 'ecb'],
    'GBP': ['gbp', 'pound', 'britain', 'uk', 'boe'],
    'JPY': ['jpy', 'yen', 'japan', 'boj'],
    'AUD': ['aud', 'australia', 'rba'],
    'CAD': ['cad', 'canada', 'boc'],
    'CHF': ['chf', 'swiss', 'switzerland', 'snb'],
    'CNY': ['cny', 'yuan', 'china', 'pboc'],
  };

  const keywords = currencyMap[currency.toUpperCase()] || [currency];

  return allNews.filter(item => {
    const searchText = (item.title + ' ' + (item.description || '')).toLowerCase();
    return keywords.some(keyword => searchText.includes(keyword));
  });
}

async function fetchByTicker(ticker) {
  return await fetchAllNews({ limit: 50 });
}

async function fetchEconomicEvents(startDate, endDate) {
  const results = [];

  const ffEvents = await rss.fetchForexFactoryNews().catch(() => {
    return MOCK_NEWS.filter(n => n.source === 'ForexFactory');
  });
  results.push(...ffEvents);

  return results.sort((a, b) => {
    const timeA = a.time || a.publishedAt;
    const timeB = b.time || b.publishedAt;
    return new Date(timeA) - new Date(timeB);
  });
}

module.exports = {
  fetchAllNews,
  fetchHighImpactNews,
  fetchByCurrency,
  fetchByTicker,
  fetchEconomicEvents,
  rss,
  MOCK_NEWS,
};
