const axios = require('axios');
const config = require('../config');

async function fetchReuters(topStories = 10) {
  const apiKey = config.news.reuters.apiKey;
  
  if (!apiKey) {
    console.warn('Reuters API key not configured');
    return [];
  }

  try {
    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        sources: 'reuters',
        apiKey,
        pageSize: topStories,
      },
      timeout: 15000,
    });

    return response.data.articles.map(article => ({
      source: 'Reuters',
      sourceUrl: article.url,
      title: article.title,
      description: article.description,
      publishedAt: article.publishedAt,
      content: article.content,
    }));
  } catch (error) {
    console.error('Reuters fetch error:', error.message);
    return [];
  }
}

async function fetchReutersBusiness() {
  const apiKey = config.news.reuters.apiKey;
  
  if (!apiKey) {
    return [];
  }

  try {
    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        category: 'business',
        sources: 'reuters',
        apiKey,
        pageSize: 20,
      },
      timeout: 15000,
    });

    return response.data.articles.map(article => ({
      source: 'Reuters',
      sourceUrl: article.url,
      title: article.title,
      description: article.description,
      publishedAt: article.publishedAt,
      content: article.content,
      category: 'business',
    }));
  } catch (error) {
    console.error('Reuters Business fetch error:', error.message);
    return [];
  }
}

async function fetchByTicker(ticker) {
  const apiKey = config.news.reuters.apiKey;
  
  if (!apiKey) {
    return [];
  }

  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: ticker,
        sources: 'reuters',
        apiKey,
        pageSize: 10,
        sortBy: 'relevancy',
      },
      timeout: 15000,
    });

    return response.data.articles.map(article => ({
      source: 'Reuters',
      sourceUrl: article.url,
      title: article.title,
      description: article.description,
      publishedAt: article.publishedAt,
      content: article.content,
      ticker,
    }));
  } catch (error) {
    console.error(`Reuters fetch for ${ticker} error:`, error.message);
    return [];
  }
}

async function searchNews(query) {
  const apiKey = config.news.reuters.apiKey;
  
  if (!apiKey) {
    return [];
  }

  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: query,
        sources: 'reuters',
        apiKey,
        pageSize: 20,
        sortBy: 'publishedAt',
      },
      timeout: 15000,
    });

    return response.data.articles.map(article => ({
      source: 'Reuters',
      sourceUrl: article.url,
      title: article.title,
      description: article.description,
      publishedAt: article.publishedAt,
      content: article.content,
      query,
    }));
  } catch (error) {
    console.error(`Reuters search for ${query} error:`, error.message);
    return [];
  }
}

module.exports = {
  fetchReuters,
  fetchReutersBusiness,
  fetchByTicker,
  searchNews,
};
