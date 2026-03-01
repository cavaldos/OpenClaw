const axios = require('axios');
const config = require('../config');

async function fetchInvestingCom() {
  const apiKey = config.news.investing.apiKey;
  
  if (!apiKey) {
    console.warn('Investing.com API key not configured');
    return [];
  }

  try {
    const response = await axios.get('https://api.investing.com/api/marketdata/news', {
      params: {
        category: 'general',
        apiKey,
        limit: 20,
      },
      timeout: 15000,
    });

    return response.data.data.map(article => ({
      source: 'Investing.com',
      sourceUrl: article.link,
      title: article.title,
      description: article.description,
      publishedAt: article.publishedAt,
    }));
  } catch (error) {
    console.error('Investing.com fetch error:', error.message);
    return [];
  }
}

async function fetchEconomicCalendar(startDate, endDate) {
  const apiKey = config.news.investing.apiKey;
  
  if (!apiKey) {
    console.warn('Investing.com API key not configured');
    return [];
  }

  try {
    const response = await axios.get('https://api.investing.com/api/marketdata/calendar', {
      params: {
        from: startDate,
        to: endDate,
        apiKey,
      },
      timeout: 15000,
    });

    return response.data.events.map(event => ({
      source: 'Investing.com Economic Calendar',
      sourceUrl: 'https://www.investing.com/economic-calendar',
      title: event.title,
      country: event.country,
      impact: event.impact,
      time: event.timestamp,
      actual: event.actual,
      forecast: event.forecast,
      previous: event.previous,
      currency: event.currency,
    }));
  } catch (error) {
    console.error('Investing.com Calendar fetch error:', error.message);
    return [];
  }
}

async function fetchByTicker(ticker) {
  const apiKey = config.news.investing.apiKey;
  
  if (!apiKey) {
    return [];
  }

  try {
    const response = await axios.get('https://api.investing.com/api/marketdata/news', {
      params: {
        query: ticker,
        apiKey,
        limit: 10,
      },
      timeout: 15000,
    });

    return response.data.data.map(article => ({
      source: 'Investing.com',
      sourceUrl: article.link,
      title: article.title,
      description: article.description,
      publishedAt: article.publishedAt,
      ticker,
    }));
  } catch (error) {
    console.error(`Investing.com fetch for ${ticker} error:`, error.message);
    return [];
  }
}

async function fetchCommoditiesNews() {
  const apiKey = config.news.investing.apiKey;
  
  if (!apiKey) {
    return [];
  }

  try {
    const response = await axios.get('https://api.investing.com/api/marketdata/news', {
      params: {
        category: 'commodities',
        apiKey,
        limit: 20,
      },
      timeout: 15000,
    });

    return response.data.data.map(article => ({
      source: 'Investing.com',
      sourceUrl: article.link,
      title: article.title,
      description: article.description,
      publishedAt: article.publishedAt,
      category: 'commodities',
    }));
  } catch (error) {
    console.error('Investing.com Commodities fetch error:', error.message);
    return [];
  }
}

module.exports = {
  fetchInvestingCom,
  fetchEconomicCalendar,
  fetchByTicker,
  fetchCommoditiesNews,
};
