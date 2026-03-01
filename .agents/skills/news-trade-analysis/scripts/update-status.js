#!/usr/bin/env node
/**
 * Update signal status
 * Usage: node update-status.js <pageId> <status>
 * Status: "📋 New" | "👀 Watching" | "✅ Traded" | "⏭️ Skipped"
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });
const { updateSignalStatus } = require('../../../../src/news-trade-db');

const [pageId, status] = process.argv.slice(2);

if (!pageId || !status) {
  console.error('Usage: node update-status.js <pageId> <status>');
  process.exit(1);
}

updateSignalStatus(pageId, status)
  .then(() => console.log(JSON.stringify({ success: true, pageId, status })))
  .catch(err => {
    console.error(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  });
