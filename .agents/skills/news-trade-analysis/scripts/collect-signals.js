#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });

const { runNewsTradePipeline } = require('../../../../src/pipeline/newsTradePipeline');

function getArgValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) {
    return fallback;
  }
  return process.argv[idx + 1];
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

async function main() {
  const dryRun = hasFlag('--dry-run');
  const save = hasFlag('--save') || !dryRun;

  const result = await runNewsTradePipeline({
    saveToNotion: save,
    minImpact: getArgValue('--min-impact', 'medium'),
    fetchLimit: toInt(getArgValue('--fetch-limit', '60'), 60),
    maxSignals: toInt(getArgValue('--max-signals', '20'), 20),
    maxResultsPerQuery: toInt(getArgValue('--max-results-per-query', '12'), 12),
    existingLimit: toInt(getArgValue('--existing-limit', '120'), 120),
    searchDepth: getArgValue('--search-depth', 'advanced'),
  });

  const topSignals = result.signals.slice(0, 5).map(signal => ({
    event: signal.event,
    symbols: signal.symbols,
    bias: signal.bias,
    impact: signal.impact,
    source: signal.source,
    url: signal.url,
  }));

  console.log(JSON.stringify({
    success: true,
    mode: dryRun ? 'dry-run' : 'save',
    databaseId: result.databaseId,
    fetchedCount: result.fetchedCount,
    generatedCount: result.generatedCount,
    savedCount: result.savedCount,
    skippedCount: result.skippedCount,
    topSignals,
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ success: false, error: error.message }));
  process.exit(1);
});
