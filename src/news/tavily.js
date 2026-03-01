const axios = require('axios');
const config = require('../config');

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

const TRUSTED_DOMAINS = [
  'reuters.com',
  'bloomberg.com',
  'cnbc.com',
  'wsj.com',
  'federalreserve.gov',
  'ecb.europa.eu',
  'imf.org',
  'worldbank.org',
  'marketwatch.com',
  'ft.com',
  'finance.yahoo.com',
  'investing.com',
];

const DEFAULT_QUERIES = [
  'Federal Reserve ECB BOE BOJ rates inflation latest market impact Reuters Bloomberg',
  'US CPI PCE NFP unemployment GDP surprise market impact forex commodities',
  'oil gold natural gas geopolitical risk sanctions conflict market reaction',
  'Nasdaq S&P 500 earnings outlook AI chip stocks macro news',
  'crypto regulation ETF flows bitcoin ethereum market impact',
];

function getSourceFromUrl(url = '') {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('reuters.com')) return 'Reuters';
    if (hostname.includes('bloomberg.com')) return 'Bloomberg';
    if (hostname.includes('cnbc.com')) return 'CNBC';
    if (hostname.includes('wsj.com')) return 'WSJ';
    if (hostname.includes('federalreserve.gov')) return 'Fed';

    return 'Other';
  } catch (_error) {
    return 'Other';
  }
}

function normalizeResult(item, fallbackQuery) {
  return {
    source: getSourceFromUrl(item.url),
    sourceUrl: item.url,
    title: (item.title || '').trim(),
    description: (item.content || item.raw_content || '').trim(),
    publishedAt: item.published_date || item.publishedAt || null,
    score: item.score || 0,
    query: fallbackQuery,
  };
}

async function searchNews(query, options = {}) {
  const apiKey = options.apiKey || config.news.tavily.apiKey;

  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not configured');
  }

  const payload = {
    api_key: apiKey,
    query,
    topic: 'news',
    search_depth: options.searchDepth || 'advanced',
    max_results: options.maxResults || 10,
    include_answer: false,
    include_raw_content: false,
    include_domains: options.includeDomains || TRUSTED_DOMAINS,
  };

  const response = await axios.post(TAVILY_ENDPOINT, payload, {
    timeout: options.timeout || 20000,
  });

  const results = Array.isArray(response.data?.results) ? response.data.results : [];
  return results.map(item => normalizeResult(item, query));
}

async function fetchGlobalFinancialNews(options = {}) {
  const queries = options.queries || DEFAULT_QUERIES;
  const maxResultsPerQuery = options.maxResultsPerQuery || 10;
  const maxItems = options.limit || 50;

  const settled = await Promise.allSettled(
    queries.map(query =>
      searchNews(query, {
        maxResults: maxResultsPerQuery,
        searchDepth: options.searchDepth,
        includeDomains: options.includeDomains,
      })
    )
  );

  const batches = [];
  const errors = [];
  for (const item of settled) {
    if (item.status === 'fulfilled') {
      batches.push(item.value);
    } else {
      errors.push(item.reason?.message || 'Tavily search failed');
      batches.push([]);
    }
  }

  const deduped = new Map();
  for (const batch of batches) {
    for (const item of batch) {
      if (!item.title || !item.sourceUrl) {
        continue;
      }

      if (!deduped.has(item.sourceUrl)) {
        deduped.set(item.sourceUrl, item);
      }
    }
  }

  const allItems = [...deduped.values()];
  allItems.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

    if (aTime === bTime) {
      return (b.score || 0) - (a.score || 0);
    }

    return bTime - aTime;
  });

  if (allItems.length === 0 && errors.length > 0) {
    throw new Error(`Unable to fetch news from Tavily: ${errors[0]}`);
  }

  return allItems.slice(0, maxItems);
}

module.exports = {
  TAVILY_ENDPOINT,
  TRUSTED_DOMAINS,
  DEFAULT_QUERIES,
  searchNews,
  fetchGlobalFinancialNews,
};
