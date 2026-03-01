require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

module.exports = {
  notion: {
    token: process.env.NOTION_TOKEN,
    databaseId: process.env.NOTION_DATABASE_ID,
  },
  news: {
    tavily: {
      apiKey: process.env.TAVILY_API_KEY || process.env.TAVILY_API || process.env.TAVILY_KEY || process.env.TAVILY,
    },
    forexfactory: {
      calendarUrl: 'https://www.forexfactory.com/calendar',
    },
    bloomberg: {
      apiKey: process.env.BLOOMBERG_API_KEY,
    },
    reuters: {
      apiKey: process.env.REUTERS_API_KEY,
    },
    investing: {
      apiKey: process.env.INVESTING_API_KEY,
    },
  },
  analysis: {
    impactThreshold: 3,
    defaultTimezone: 'America/New_York',
  },
};
