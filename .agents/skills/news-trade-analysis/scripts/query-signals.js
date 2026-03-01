#!/usr/bin/env node
/**
 * Query signals from Notion database
 * Usage: node query-signals.js [filter]
 * Filters: all, new, bullish, bearish
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });
const { getSignals, getNewSignals, getBullishSignals, getBearishSignals } = require('../../../../src/news-trade-db');

const filter = process.argv[2] || 'all';

const queries = {
  all: getSignals,
  new: getNewSignals,
  bullish: getBullishSignals,
  bearish: getBearishSignals,
};

const queryFn = queries[filter] || queries.all;

queryFn()
  .then(signals => {
    console.log(JSON.stringify(signals, null, 2));
  })
  .catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
