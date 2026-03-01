const axios = require('axios');
const Parser = require('rss-parser');

const parser = new Parser();

const RSS_FEEDS = {
  forexfactory: 'https://www.forexfactory.com/rss',
  bloomberg: 'https://feeds.bloomberg.com/markets/news.rss',
  reuters: 'https://www.reuters.com/rss/news',
  investing: 'https://www.investing.com/rss/news.rss',
  forex: 'https://www.forexnewsnow.com/feed/',
  tradingview: 'https://www.tradingview.com/markets/news/feed/',
  yahoofinance: 'https://finance.yahoo.com/news/rssindex',
  marketwatch: 'https://feeds.marketwatch.com/marketwatch/topstories/',
  forexstreet: 'https://www.forexstreet.net/rss/news',
};

async function fetchRSS(feedUrl, options = {}) {
  try {
    const feed = await parser.parseURL(feedUrl);
    return feed.items.map(item => ({
      source: options.source || 'RSS',
      sourceUrl: item.link || feedUrl,
      title: item.title,
      description: item.contentSnippet || item.content || '',
      publishedAt: item.pubDate || item.isoDate,
      guid: item.guid || item.link,
    }));
  } catch (error) {
    console.log(`RSS fetch error for ${feedUrl}:`, error.message);
    return [];
  }
}

async function fetchAllFeeds(sources = Object.keys(RSS_FEEDS)) {
  const results = [];
  
  for (const source of sources) {
    if (RSS_FEEDS[source]) {
      const items = await fetchRSS(RSS_FEEDS[source], { source: source.charAt(0).toUpperCase() + source.slice(1) });
      results.push(...items);
    }
  }

  return results.sort((a, b) => 
    new Date(b.publishedAt) - new Date(a.publishedAt)
  );
}

async function fetchForexFactoryNews() {
  return fetchRSS(RSS_FEEDS.forexfactory, { source: 'ForexFactory' });
}

async function fetchBloombergNews() {
  return fetchRSS(RSS_FEEDS.bloomberg, { source: 'Bloomberg' });
}

async function fetchReutersNews() {
  return fetchRSS(RSS_FEEDS.reuters, { source: 'Reuters' });
}

async function fetchInvestingNews() {
  return fetchRSS(RSS_FEEDS.investing, { source: 'Investing' });
}

module.exports = {
  fetchRSS,
  fetchAllFeeds,
  fetchForexFactoryNews,
  fetchBloombergNews,
  fetchReutersNews,
  fetchInvestingNews,
  RSS_FEEDS,
};
