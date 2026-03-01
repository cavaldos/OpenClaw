const newsFetcher = require('../news/fetcher');
const evaluator = require('../analysis/evaluator');
const notionDb = require('../notion/database');
const config = require('../config');
const { runNewsTradePipeline } = require('../pipeline/newsTradePipeline');

class NewsSkill {
  constructor(options = {}) {
    this.useAI = options.useAI !== false;
    this.aiApiKey = options.aiApiKey || process.env.OPENAI_API_KEY;
    this.minImpact = options.minImpact || 'Medium';
  }

  async fetchNews(options = {}) {
    const {
      sources = ['forexfactory', 'bloomberg', 'reuters', 'investing'],
      limit = 50,
      highImpactOnly = false,
    } = options;

    if (highImpactOnly) {
      return await newsFetcher.fetchHighImpactNews();
    }

    return await newsFetcher.fetchAllNews({ sources, limit });
  }

  async analyzeNews(newsItems, options = {}) {
    return await evaluator.evaluateNewsBatch(newsItems, {
      useAI: this.useAI,
      aiApiKey: this.aiApiKey,
      delay: 500,
    });
  }

  getTradingOpportunities(analyzedNews) {
    return evaluator.getTradingOpportunities(analyzedNews);
  }

  async saveToNotion(eventData) {
    return await notionDb.addNewsEvent(eventData);
  }

  async getSavedEvents(options = {}) {
    return await notionDb.getNewsEvents(options);
  }

  async runFullPipeline(options = {}) {
    console.log('🔄 Fetching news...');
    const news = await this.fetchNews({
      highImpactOnly: options.highImpactOnly || false,
      limit: options.limit || 30,
    });
    console.log(`   Found ${news.length} news items`);

    console.log('🔄 Analyzing news...');
    const analyzed = await this.analyzeNews(news);
    
    console.log('🔄 Getting trading opportunities...');
    const opportunities = this.getTradingOpportunities(analyzed);
    console.log(`   Found ${opportunities.length} trading opportunities`);

    if (options.saveToNotion) {
      console.log('🔄 Saving to Notion...');
      for (const opp of opportunities) {
        await this.saveToNotion({
          title: opp.title,
          symbols: [opp.symbol],
          time: opp.time,
          bias: opp.bias,
          confidence: opp.confidence,
          source: opp.source,
          description: opp.reason,
          impact: opp.confidence === 'High' ? 'High' : 'Medium',
        });
      }
      console.log(`   Saved ${opportunities.length} events to Notion`);
    }

    return {
      news,
      analyzed,
      opportunities,
    };
  }

  async runGlobalSignalsPipeline(options = {}) {
    return await runNewsTradePipeline({
      saveToNotion: options.saveToNotion === true,
      minImpact: options.minImpact || 'medium',
      fetchLimit: options.fetchLimit || 60,
      maxSignals: options.maxSignals || 20,
      maxResultsPerQuery: options.maxResultsPerQuery || 12,
      existingLimit: options.existingLimit || 120,
      searchDepth: options.searchDepth || 'advanced',
      queries: options.queries,
      includeDomains: options.includeDomains,
    });
  }

  async getEventsByDateRange(startDate, endDate) {
    return await notionDb.getNewsEvents({ startDate, endDate });
  }

  async createNotionDatabase(parentPageId) {
    return await notionDb.createDatabase(parentPageId, 'News Trading Events');
  }

  async updateEvent(pageId, eventData) {
    return await notionDb.updateNewsEvent(pageId, eventData);
  }

  async deleteEvent(pageId) {
    return await notionDb.deleteNewsEvent(pageId);
  }
}

const newsSkill = new NewsSkill();

async function fetchNews(options) {
  return await newsSkill.fetchNews(options);
}

async function analyzeNews(newsItems, options) {
  return await newsSkill.analyzeNews(newsItems, options);
}

function getTradingOpportunities(analyzedNews) {
  return newsSkill.getTradingOpportunities(analyzedNews);
}

async function saveToNotion(eventData) {
  return await newsSkill.saveToNotion(eventData);
}

async function getSavedEvents(options) {
  return await newsSkill.getSavedEvents(options);
}

async function runFullPipeline(options) {
  return await newsSkill.runFullPipeline(options);
}

async function runGlobalSignalsPipeline(options) {
  return await newsSkill.runGlobalSignalsPipeline(options);
}

async function getEventsByDateRange(startDate, endDate) {
  return await newsSkill.getEventsByDateRange(startDate, endDate);
}

async function createNotionDatabase(parentPageId) {
  return await newsSkill.createNotionDatabase(parentPageId);
}

module.exports = {
  NewsSkill,
  newsSkill,
  fetchNews,
  analyzeNews,
  getTradingOpportunities,
  saveToNotion,
  getSavedEvents,
  runFullPipeline,
  runGlobalSignalsPipeline,
  getEventsByDateRange,
  createNotionDatabase,
};
