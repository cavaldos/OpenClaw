#!/usr/bin/env node
/**
 * Add a trading signal to Notion database
 * Usage: node add-signal.js '<json>'
 * JSON fields: event, symbols[], time, bias, impact, url, details, source
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });
const { addSignal } = require('../../../../src/news-trade-db');

const input = JSON.parse(process.argv[2]);
addSignal(input)
  .then(page => {
    console.log(JSON.stringify({
      success: true,
      id: page.id,
      url: page.url,
      event: input.event,
    }));
  })
  .catch(err => {
    console.error(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  });
