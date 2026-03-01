const axios = require('axios');
const config = require('../config');

async function fetchBloomberg(topStories = 10) {
  const apiKey = config.news.bloomberg.apiKey;
  
  if (!apiKey) {
    console.warn('Bloomberg API key not configured');
    return [];
  }

  try {
    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        sources: 'bloomberg',
        apiKey,
        pageSize: topStories,
      },
      timeout: 15000,
    });

    return response.data.articles.map(article => ({
      source: 'Bloomberg',
      sourceUrl: article.url,
      title: article.title,
      description: article.description,
      publishedAt: article.publishedAt,
      content: article.content,
    }));
  } catch (error) {
    console.error('Bloomberg fetch error:', error.message);
    return [];
  }
}

async function fetchBloombergMarkets() {
  const apiKey = config.news.bloomberg.apiKey;
  
  if (!apiKey) {
    return [];
  }

  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'markets OR stock OR economy',
        sources: 'bloomberg',
        apiKey,
        pageSize: 20,
        sortBy: 'publishedAt',
      },
      timeout: 15000,
    });

    return response.data.articles.map(article => ({
      source: 'Bloomberg',
      sourceUrl: article.url,
      title: article.title,
      description: article.description,
      publishedAt: article.publishedAt,
      content: article.content,
      category: 'markets',
    }));
  } catch (error) {
    console.error('Bloomberg Markets fetch error:', error.message);
    return [];
  }
}

async function fetchByTicker(ticker) {
  const apiKey = config.news.bloomberg.apiKey;
  
  if (!apiKey) {
    return [];
  }

  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: ticker,
        sources: 'bloomberg',
        apiKey,
        pageSize: 10,
        sortBy: 'relevancy',
      },
      timeout: 15000,
    });

    return response.data.articles.map(article => ({
      source: 'Bloomberg',
      sourceUrl: article.url,
      title: article.title,
      description: article.description,
      publishedAt: article.publishedAt,
      content: article.content,
      ticker,
    }));
  } catch (error) {
    console.error(`Bloomberg fetch for ${ticker} error:`, error.message);
    return [];
  }
}

module.exports = {
  fetchBloomberg,
  fetchBloombergMarkets,
  fetchByTicker,
};
