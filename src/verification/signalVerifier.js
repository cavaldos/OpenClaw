const {
  isForexSymbol,
  filterForexSymbols,
  fetchVerificationPrices,
  calcPctChange,
} = require('./priceChecker');

// ── Bias normalization ──────────────────────────────────────────────

function normalizeBias(bias) {
  const lower = (bias || '').toLowerCase();
  if (/bullish|tang/i.test(lower)) return 'bullish';
  if (/bearish|giam/i.test(lower)) return 'bearish';
  return 'neutral';
}

// ── Verification logic ──────────────────────────────────────────────

/**
 * Determine if a signal's bias prediction was correct based on price change.
 *
 * For a forex pair like EURUSD:
 *   - Bullish bias + positive price change = correct
 *   - Bearish bias + negative price change = correct
 *   - Neutral bias = always "neutral" (not scored)
 *
 * @param {string} bias      - Original bias: 'bullish', 'bearish', 'neutral'
 * @param {number} pctChange - Percentage change in price
 * @returns {'correct' | 'incorrect' | 'neutral' | 'flat'}
 */
function checkBiasAccuracy(bias, pctChange) {
  if (pctChange == null) return null;
  if (bias === 'neutral') return 'neutral';

  // Flat threshold: < 0.01% is considered no meaningful move
  const FLAT_THRESHOLD = 0.01;
  if (Math.abs(pctChange) < FLAT_THRESHOLD) return 'flat';

  if (bias === 'bullish' && pctChange > 0) return 'correct';
  if (bias === 'bearish' && pctChange < 0) return 'correct';
  return 'incorrect';
}

/**
 * Compute a verification score (0-100) based on how well the signal predicted direction.
 *
 * Scoring logic:
 *   - Each timeframe (1D, 3D, 7D) contributes a sub-score
 *   - Weights: 1D = 30%, 3D = 40%, 7D = 30%
 *   - Sub-score per timeframe:
 *     - Correct direction + strong move (>0.3%)  = 100
 *     - Correct direction + weak move   (0.01-0.3%) = 60
 *     - Flat (<0.01%)                              = 40
 *     - Incorrect direction + weak move            = 20
 *     - Incorrect direction + strong move          = 0
 *   - Neutral bias always scores 50 (not meaningful)
 */
function computeVerificationScore(bias, changes) {
  if (bias === 'neutral') return { score: 50, label: 'Neutral - Not scored' };

  const weights = { d1: 0.3, d3: 0.4, d7: 0.3 };
  const entries = [
    { key: 'd1', pct: changes.d1 },
    { key: 'd3', pct: changes.d3 },
    { key: 'd7', pct: changes.d7 },
  ];

  let totalWeight = 0;
  let totalScore = 0;

  for (const { key, pct } of entries) {
    if (pct == null) continue;

    const w = weights[key];
    totalWeight += w;

    const accuracy = checkBiasAccuracy(bias, pct);
    const absPct = Math.abs(pct);

    let subScore;
    if (accuracy === 'correct') {
      subScore = absPct > 0.3 ? 100 : 60;
    } else if (accuracy === 'flat') {
      subScore = 40;
    } else {
      // incorrect
      subScore = absPct > 0.3 ? 0 : 20;
    }

    totalScore += subScore * w;
  }

  if (totalWeight === 0) return { score: null, label: 'No price data available' };

  const finalScore = Math.round(totalScore / totalWeight);

  let label;
  if (finalScore >= 80) label = 'Strongly Correct';
  else if (finalScore >= 60) label = 'Correct';
  else if (finalScore >= 40) label = 'Inconclusive';
  else if (finalScore >= 20) label = 'Weakly Incorrect';
  else label = 'Strongly Incorrect';

  return { score: finalScore, label };
}

// ── Verification status ─────────────────────────────────────────────

function getVerificationStatus(score, bias) {
  if (bias === 'neutral') return 'N/A - Neutral';
  if (score == null) return 'Pending';
  if (score >= 60) return 'Verified Correct';
  if (score >= 40) return 'Inconclusive';
  return 'Verified Incorrect';
}

// ── Main verification function ──────────────────────────────────────

/**
 * Verify a single signal against actual forex price data.
 *
 * @param {object} signal - Signal object from Notion (must have: symbols, time, bias)
 * @returns {Promise<object>} Verification result
 */
async function verifySignal(signal) {
  const result = {
    signalId: signal.id,
    event: signal.event,
    originalBias: signal.bias,
    originalImpact: signal.impact,
    symbols: signal.symbols || [],
    signalTime: signal.time,
    verifiable: false,
    forexSymbols: [],
    nonForexSymbols: [],
    priceData: null,
    changes: {},
    verificationScore: null,
    verificationStatus: 'N/A',
    verificationNotes: '',
  };

  // 1. Find verifiable forex symbols
  const forexSymbols = filterForexSymbols(signal.symbols);
  const nonForexSymbols = (signal.symbols || []).filter(s => !isForexSymbol(s));
  result.forexSymbols = forexSymbols;
  result.nonForexSymbols = nonForexSymbols;

  if (forexSymbols.length === 0) {
    result.verificationStatus = 'N/A - Not forex';
    result.verificationNotes = `Symbols [${signal.symbols.join(', ')}] are not forex pairs. Only forex can be verified with Frankfurter API.`;
    return result;
  }

  // 2. Extract signal date
  const signalDate = extractDate(signal.time);
  if (!signalDate) {
    result.verificationStatus = 'N/A - No date';
    result.verificationNotes = 'Signal has no valid time/date for price lookup.';
    return result;
  }

  // Check if signal is too recent (need at least T+1 data)
  const today = new Date();
  const signalDateObj = new Date(signalDate);
  const daysSinceSignal = Math.floor((today - signalDateObj) / (1000 * 60 * 60 * 24));
  if (daysSinceSignal < 2) {
    result.verificationStatus = 'Pending - Too recent';
    result.verificationNotes = `Signal from ${signalDate} is too recent (${daysSinceSignal} days ago). Need at least 2 days of price data.`;
    return result;
  }

  // 3. Use the first verifiable forex symbol for primary verification
  const primarySymbol = forexSymbols[0];
  const bias = normalizeBias(signal.bias);

  try {
    const prices = await fetchVerificationPrices(primarySymbol, signalDate);
    if (!prices || !prices.t0) {
      result.verificationStatus = 'N/A - No price data';
      result.verificationNotes = `No Frankfurter data available for ${primarySymbol} around ${signalDate}.`;
      return result;
    }

    result.verifiable = true;
    result.priceData = prices;

    // 4. Calculate price changes
    const t0Rate = prices.t0.rate;
    result.changes = {
      d1: prices.t1 ? calcPctChange(t0Rate, prices.t1.rate) : null,
      d3: prices.t3 ? calcPctChange(t0Rate, prices.t3.rate) : null,
      d7: prices.t7 ? calcPctChange(t0Rate, prices.t7.rate) : null,
    };

    // 5. Compute verification score
    const { score, label } = computeVerificationScore(bias, result.changes);
    result.verificationScore = score;
    result.verificationStatus = getVerificationStatus(score, bias);

    // 6. Build notes
    const notes = [];
    notes.push(`Symbol: ${primarySymbol} | Bias: ${signal.bias}`);
    notes.push(`Price at signal (${prices.t0.date}): ${t0Rate}`);
    if (result.changes.d1 != null) {
      notes.push(`T+1 (${prices.t1.date}): ${prices.t1.rate} (${formatPct(result.changes.d1)})`);
    }
    if (result.changes.d3 != null) {
      notes.push(`T+3 (${prices.t3.date}): ${prices.t3.rate} (${formatPct(result.changes.d3)})`);
    }
    if (result.changes.d7 != null) {
      notes.push(`T+7 (${prices.t7.date}): ${prices.t7.rate} (${formatPct(result.changes.d7)})`);
    }
    notes.push(`Verdict: ${label} (score ${score}/100)`);

    if (nonForexSymbols.length > 0) {
      notes.push(`Note: ${nonForexSymbols.join(', ')} skipped (not forex).`);
    }

    result.verificationNotes = notes.join('\n');

  } catch (error) {
    result.verificationStatus = 'Error';
    result.verificationNotes = `Verification failed: ${error.message}`;
  }

  return result;
}

/**
 * Verify a batch of signals.
 * Includes a small delay between API calls to respect rate limits.
 *
 * @param {Array} signals - Array of signal objects
 * @param {object} options - { delayMs: number }
 * @returns {Promise<Array>}
 */
async function verifySignals(signals, options = {}) {
  const delayMs = options.delayMs || 500;
  const results = [];

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const result = await verifySignal(signal);
    results.push(result);

    // Rate limit protection
    if (i < signals.length - 1) {
      await sleep(delayMs);
    }
  }

  return results;
}

/**
 * Generate an accuracy report from verification results.
 */
function generateReport(results) {
  const verifiable = results.filter(r => r.verifiable);
  const scored = verifiable.filter(r => r.verificationScore != null);
  const correct = scored.filter(r => r.verificationScore >= 60);
  const incorrect = scored.filter(r => r.verificationScore < 40);
  const inconclusive = scored.filter(r => r.verificationScore >= 40 && r.verificationScore < 60);

  // By bias
  const byBias = {};
  for (const r of scored) {
    const bias = normalizeBias(r.originalBias);
    if (!byBias[bias]) byBias[bias] = { total: 0, correct: 0, avgScore: 0, scores: [] };
    byBias[bias].total++;
    byBias[bias].scores.push(r.verificationScore);
    if (r.verificationScore >= 60) byBias[bias].correct++;
  }
  for (const bias of Object.keys(byBias)) {
    const group = byBias[bias];
    group.avgScore = Math.round(group.scores.reduce((a, b) => a + b, 0) / group.scores.length);
    group.accuracy = group.total > 0 ? Math.round((group.correct / group.total) * 100) : 0;
    delete group.scores;
  }

  // By impact
  const byImpact = {};
  for (const r of scored) {
    const impact = (r.originalImpact || 'unknown').toLowerCase().replace(/[^a-z]/g, '');
    const key = /high/.test(impact) ? 'high' : /medium/.test(impact) ? 'medium' : 'low';
    if (!byImpact[key]) byImpact[key] = { total: 0, correct: 0, avgScore: 0, scores: [] };
    byImpact[key].total++;
    byImpact[key].scores.push(r.verificationScore);
    if (r.verificationScore >= 60) byImpact[key].correct++;
  }
  for (const key of Object.keys(byImpact)) {
    const group = byImpact[key];
    group.avgScore = Math.round(group.scores.reduce((a, b) => a + b, 0) / group.scores.length);
    group.accuracy = group.total > 0 ? Math.round((group.correct / group.total) * 100) : 0;
    delete group.scores;
  }

  // By symbol
  const bySymbol = {};
  for (const r of scored) {
    for (const sym of r.forexSymbols) {
      if (!bySymbol[sym]) bySymbol[sym] = { total: 0, correct: 0, avgScore: 0, scores: [] };
      bySymbol[sym].total++;
      bySymbol[sym].scores.push(r.verificationScore);
      if (r.verificationScore >= 60) bySymbol[sym].correct++;
    }
  }
  for (const sym of Object.keys(bySymbol)) {
    const group = bySymbol[sym];
    group.avgScore = Math.round(group.scores.reduce((a, b) => a + b, 0) / group.scores.length);
    group.accuracy = group.total > 0 ? Math.round((group.correct / group.total) * 100) : 0;
    delete group.scores;
  }

  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((a, r) => a + r.verificationScore, 0) / scored.length)
    : null;

  return {
    summary: {
      totalSignals: results.length,
      verifiable: verifiable.length,
      scored: scored.length,
      nonForex: results.filter(r => r.verificationStatus === 'N/A - Not forex').length,
      tooRecent: results.filter(r => r.verificationStatus === 'Pending - Too recent').length,
      noData: results.filter(r => r.verificationStatus.startsWith('N/A')).length,
    },
    accuracy: {
      correct: correct.length,
      incorrect: incorrect.length,
      inconclusive: inconclusive.length,
      accuracyRate: scored.length > 0 ? Math.round((correct.length / scored.length) * 100) : null,
      averageScore: avgScore,
    },
    byBias,
    byImpact,
    bySymbol,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function extractDate(timeString) {
  if (!timeString) return null;
  // Handle ISO format, date-only, or datetime strings
  const match = timeString.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function formatPct(pct) {
  if (pct == null) return 'N/A';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(4)}%`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  verifySignal,
  verifySignals,
  generateReport,
  normalizeBias,
  checkBiasAccuracy,
  computeVerificationScore,
};
