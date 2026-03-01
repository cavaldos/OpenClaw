#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });

const schedule = require('node-schedule');
const { runNewsTradePipeline } = require('../../../../src/pipeline/newsTradePipeline');

const cron = process.argv[2] || '*/30 * * * *';

async function execute() {
  const startedAt = new Date().toISOString();

  try {
    const result = await runNewsTradePipeline({
      saveToNotion: true,
      minImpact: process.argv[3] || 'medium',
      fetchLimit: 60,
      maxSignals: 20,
      maxResultsPerQuery: 12,
      existingLimit: 120,
      searchDepth: 'advanced',
    });

    console.log(JSON.stringify({
      success: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      fetchedCount: result.fetchedCount,
      generatedCount: result.generatedCount,
      savedCount: result.savedCount,
      skippedCount: result.skippedCount,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error.message,
    }));
  }
}

console.log(`News trade scheduler started. Cron: ${cron}`);
execute();
schedule.scheduleJob(cron, execute);
