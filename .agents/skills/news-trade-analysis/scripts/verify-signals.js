#!/usr/bin/env node
/**
 * Phase 3: Signal Verification against Real Forex Prices
 *
 * Verifies trading signal predictions by comparing bias (bullish/bearish)
 * against actual price movements using the Frankfurter API.
 * Only forex pairs (EURUSD, GBPUSD, USDJPY, etc.) can be verified.
 *
 * Modes:
 *   --all              Verify all verifiable signals and update Notion
 *   --force            Force re-verification of already verified signals
 *   --dry-run          Verify all signals but don't update Notion (preview only)
 *   --id <pageId>      Verify a specific signal by Notion page ID
 *   --report           Show accuracy report from already-verified signals
 *   --stats            Quick summary of verification status
 *
 * Examples:
 *   node verify-signals.js --all
 *   node verify-signals.js --dry-run
 *   node verify-signals.js --id 315f312e-ab25-81bd-9383-ec825d7b9470
 *   node verify-signals.js --report
 *   node verify-signals.js --stats
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });

const { getSignals, updateSignalVerification } = require('../../../../src/news-trade-db');
const { verifySignal, verifySignals, generateReport } = require('../../../../src/verification/signalVerifier');
const { isForexSymbol } = require('../../../../src/verification/priceChecker');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatPct(pct) {
  if (pct == null) return 'N/A';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(4)}%`;
}

function printSignalSummary(signal) {
  console.log(`  Event: ${signal.event}`);
  console.log(`  Symbols: ${(signal.symbols || []).join(', ')}`);
  console.log(`  Bias: ${signal.bias} | Impact: ${signal.impact}`);
  console.log(`  Time: ${signal.time || 'N/A'}`);
}

function printVerificationResult(result) {
  console.log(`\n--- ${result.event} ---`);
  console.log(`  Signal ID: ${result.signalId}`);
  console.log(`  Original Bias: ${result.originalBias}`);
  console.log(`  Forex Symbols: ${result.forexSymbols.join(', ') || 'none'}`);

  if (result.nonForexSymbols.length > 0) {
    console.log(`  Non-Forex (skipped): ${result.nonForexSymbols.join(', ')}`);
  }

  console.log(`  Status: ${result.verificationStatus}`);

  if (result.verifiable && result.priceData) {
    const p = result.priceData;
    console.log(`  Price at T+0 (${p.t0?.date}): ${p.t0?.rate}`);
    if (p.t1) console.log(`  Price at T+1 (${p.t1.date}): ${p.t1.rate} (${formatPct(result.changes.d1)})`);
    if (p.t3) console.log(`  Price at T+3 (${p.t3.date}): ${p.t3.rate} (${formatPct(result.changes.d3)})`);
    if (p.t7) console.log(`  Price at T+7 (${p.t7.date}): ${p.t7.rate} (${formatPct(result.changes.d7)})`);
    console.log(`  Verification Score: ${result.verificationScore}/100`);
  }

  if (result.verificationNotes) {
    console.log(`  Notes: ${result.verificationNotes.split('\n')[0]}`);
  }
}

// ── Commands ────────────────────────────────────────────────────────

async function cmdVerifyAll(dryRun = false) {
  console.log(`Fetching signals from Notion...`);
  const signals = await getSignals({ pageSize: 100 });
  console.log(`Found ${signals.length} signals total.`);

  // Filter signals that need verification:
  // - Have at least one forex symbol
  // - Not already verified (unless --force)
  const force = hasFlag('--force');
  const toVerify = signals.filter(s => {
    const hasForex = (s.symbols || []).some(sym => isForexSymbol(sym));
    const alreadyVerified = /Verified|N\/A/i.test(s.verificationStatus || '');
    return hasForex && (force || !alreadyVerified);
  });

  console.log(`${toVerify.length} signals eligible for verification (have forex symbols${force ? ', including re-verify' : ', not yet verified'}).`);

  if (toVerify.length === 0) {
    console.log('Nothing to verify.');
    return;
  }

  console.log(`\nStarting verification${dryRun ? ' (DRY RUN - no Notion updates)' : ''}...\n`);

  const results = await verifySignals(toVerify, { delayMs: 600 });

  let updatedCount = 0;
  let errorCount = 0;

  for (const result of results) {
    printVerificationResult(result);

    if (!dryRun && result.verifiable && result.verificationScore != null) {
      try {
        const notionUpdate = await updateSignalVerification(result.signalId, {
          verificationStatus: result.verificationStatus,
          priceAtSignal: result.priceData?.t0?.rate || null,
          priceChange1D: result.changes?.d1 || null,
          priceChange3D: result.changes?.d3 || null,
          verificationScore: result.verificationScore,
          verificationNotes: result.verificationNotes,
        });

        if (notionUpdate) {
          updatedCount++;
          console.log(`  -> Notion updated.`);
        } else {
          console.log(`  -> Notion: no verification columns in database (skipped update).`);
        }
      } catch (err) {
        errorCount++;
        console.error(`  -> Notion update failed: ${err.message}`);
      }
    } else if (!dryRun && !result.verifiable) {
      // Update non-verifiable signals with their status too
      try {
        const notionUpdate = await updateSignalVerification(result.signalId, {
          verificationStatus: result.verificationStatus,
          verificationNotes: result.verificationNotes,
        });
        if (notionUpdate) {
          console.log(`  -> Notion status updated (${result.verificationStatus}).`);
        }
      } catch (_err) {
        // Silently skip - verification columns may not exist
      }
    }
  }

  // Summary
  const report = generateReport(results);
  console.log('\n========== VERIFICATION SUMMARY ==========');
  console.log(`Total processed: ${results.length}`);
  console.log(`Verifiable (forex): ${report.summary.verifiable}`);
  console.log(`Scored: ${report.accuracy.correct + report.accuracy.incorrect + report.accuracy.inconclusive}`);
  console.log(`Correct: ${report.accuracy.correct}`);
  console.log(`Incorrect: ${report.accuracy.incorrect}`);
  console.log(`Inconclusive: ${report.accuracy.inconclusive}`);
  if (report.accuracy.accuracyRate != null) {
    console.log(`Accuracy Rate: ${report.accuracy.accuracyRate}%`);
    console.log(`Average Score: ${report.accuracy.averageScore}/100`);
  }
  if (!dryRun) {
    console.log(`Notion updated: ${updatedCount} | Errors: ${errorCount}`);
  } else {
    console.log(`(DRY RUN - no changes made to Notion)`);
  }
  console.log('==========================================');
}

async function cmdVerifyOne(pageId) {
  console.log(`Fetching signal ${pageId}...`);
  const signals = await getSignals({ pageSize: 100 });
  const signal = signals.find(s => s.id === pageId);

  if (!signal) {
    console.error(`Signal not found: ${pageId}`);
    process.exit(1);
  }

  printSignalSummary(signal);
  console.log('\nVerifying...');

  const result = await verifySignal(signal);
  printVerificationResult(result);

  if (result.verifiable && result.verificationScore != null) {
    try {
      const notionUpdate = await updateSignalVerification(pageId, {
        verificationStatus: result.verificationStatus,
        priceAtSignal: result.priceData?.t0?.rate || null,
        priceChange1D: result.changes?.d1 || null,
        priceChange3D: result.changes?.d3 || null,
        verificationScore: result.verificationScore,
        verificationNotes: result.verificationNotes,
      });
      if (notionUpdate) {
        console.log('\n-> Notion updated successfully.');
      } else {
        console.log('\n-> No verification columns in Notion database.');
      }
    } catch (err) {
      console.error(`\n-> Notion update failed: ${err.message}`);
    }
  }

  // Also output as JSON for programmatic use
  console.log('\n--- JSON Output ---');
  console.log(JSON.stringify(result, null, 2));
}

async function cmdReport() {
  console.log('Fetching all signals from Notion...');
  const signals = await getSignals({ pageSize: 100 });

  // Re-verify all to get fresh data (or use cached verification results)
  const forexSignals = signals.filter(s =>
    (s.symbols || []).some(sym => isForexSymbol(sym))
  );

  console.log(`Found ${signals.length} signals total, ${forexSignals.length} with forex symbols.`);
  console.log('Verifying forex signals against historical prices...\n');

  const results = await verifySignals(forexSignals, { delayMs: 600 });
  const report = generateReport(results);

  console.log('========== ACCURACY REPORT ==========\n');

  console.log('--- Overview ---');
  console.log(`Total signals: ${report.summary.totalSignals}`);
  console.log(`Verifiable (forex): ${report.summary.verifiable}`);
  console.log(`Non-forex (skipped): ${report.summary.nonForex}`);
  console.log(`Too recent: ${report.summary.tooRecent}`);
  console.log(`Scored: ${report.accuracy.correct + report.accuracy.incorrect + report.accuracy.inconclusive}`);

  console.log('\n--- Accuracy ---');
  console.log(`Correct: ${report.accuracy.correct}`);
  console.log(`Incorrect: ${report.accuracy.incorrect}`);
  console.log(`Inconclusive: ${report.accuracy.inconclusive}`);
  if (report.accuracy.accuracyRate != null) {
    console.log(`Accuracy Rate: ${report.accuracy.accuracyRate}%`);
    console.log(`Average Score: ${report.accuracy.averageScore}/100`);
  } else {
    console.log('Accuracy Rate: N/A (no scored signals)');
  }

  if (Object.keys(report.byBias).length > 0) {
    console.log('\n--- By Bias ---');
    for (const [bias, stats] of Object.entries(report.byBias)) {
      console.log(`  ${bias}: ${stats.correct}/${stats.total} correct (${stats.accuracy}%) | avg score: ${stats.avgScore}`);
    }
  }

  if (Object.keys(report.byImpact).length > 0) {
    console.log('\n--- By Impact ---');
    for (const [impact, stats] of Object.entries(report.byImpact)) {
      console.log(`  ${impact}: ${stats.correct}/${stats.total} correct (${stats.accuracy}%) | avg score: ${stats.avgScore}`);
    }
  }

  if (Object.keys(report.bySymbol).length > 0) {
    console.log('\n--- By Symbol ---');
    const sorted = Object.entries(report.bySymbol).sort((a, b) => b[1].avgScore - a[1].avgScore);
    for (const [sym, stats] of sorted) {
      console.log(`  ${sym}: ${stats.correct}/${stats.total} correct (${stats.accuracy}%) | avg score: ${stats.avgScore}`);
    }
  }

  console.log('\n=====================================');

  // Output JSON for programmatic use
  console.log('\n--- JSON Report ---');
  console.log(JSON.stringify(report, null, 2));
}

async function cmdStats() {
  const signals = await getSignals({ pageSize: 100 });

  const stats = {
    total: signals.length,
    withForex: signals.filter(s => (s.symbols || []).some(sym => isForexSymbol(sym))).length,
    withoutForex: signals.filter(s => !(s.symbols || []).some(sym => isForexSymbol(sym))).length,
    verified: {
      correct: signals.filter(s => /Verified Correct/i.test(s.verificationStatus || '')).length,
      incorrect: signals.filter(s => /Verified Incorrect/i.test(s.verificationStatus || '')).length,
      inconclusive: signals.filter(s => /Inconclusive/i.test(s.verificationStatus || '')).length,
      pending: signals.filter(s => /Pending/i.test(s.verificationStatus || '') || !s.verificationStatus).length,
      notApplicable: signals.filter(s => /N\/A/i.test(s.verificationStatus || '')).length,
    },
    avgVerificationScore: null,
  };

  const scored = signals.filter(s => s.verificationScore != null);
  if (scored.length > 0) {
    stats.avgVerificationScore = Math.round(
      scored.reduce((acc, s) => acc + s.verificationScore, 0) / scored.length
    );
  }

  console.log(JSON.stringify(stats, null, 2));
}

// ── Main ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

(async () => {
  switch (command) {
    case '--all':
      await cmdVerifyAll(false);
      break;

    case '--dry-run':
      await cmdVerifyAll(true);
      break;

    case '--id':
      if (!args[1]) { console.error('Usage: --id <pageId>'); process.exit(1); }
      await cmdVerifyOne(args[1]);
      break;

    case '--report':
      await cmdReport();
      break;

    case '--stats':
      await cmdStats();
      break;

    default:
      console.log(`Phase 3: Signal Verification against Real Forex Prices

Usage:
  node verify-signals.js --all          Verify all eligible signals & update Notion
  node verify-signals.js --force        Force re-verify already verified signals
  node verify-signals.js --dry-run      Verify all signals (preview, no Notion updates)
  node verify-signals.js --id <id>      Verify a specific signal by page ID
  node verify-signals.js --report       Full accuracy report with breakdowns
  node verify-signals.js --stats       Quick verification status summary

Only forex pairs (EURUSD, GBPUSD, USDJPY, etc.) can be verified.
Non-forex symbols (XAUUSD, US500, BTCUSD, etc.) are marked as N/A.`);
  }
})().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});

module.exports = { cmdVerifyAll, cmdVerifyOne, cmdReport, cmdStats };
