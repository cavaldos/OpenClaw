#!/usr/bin/env node
/**
 * Phase 2: Multi-Model AI Consensus Analysis
 *
 * Modes:
 *   --pending          List signals pending analysis (JSON output)
 *   --analyze <id>     Output analysis prompt for a specific signal
 *   --update <id>      Update a signal with analysis result (reads JSON from stdin)
 *   --batch-update     Update multiple signals (reads JSON array from stdin)
 *   --ollama <id>      Auto-analyze with Ollama (requires Ollama running)
 *   --status           Show analysis status summary
 *
 * Examples:
 *   node analyze-signals.js --pending
 *   node analyze-signals.js --analyze 315f312e-ab25-81bd-9383-ec825d7b9470
 *   echo '{"bias":"bullish",...}' | node analyze-signals.js --update 315f312e-ab25-81bd-9383-ec825d7b9470
 *   echo '[{...}]' | node analyze-signals.js --batch-update
 *   node analyze-signals.js --status
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '..', '.env'), quiet: true });
const { getSignals, getNewSignals, updateSignalAnalysis, getSchema } = require('../../../../src/news-trade-db');

// ── Consensus algorithm ─────────────────────────────────────────────

const ACTION_MAP = { strong_buy: 5, buy: 4, hold: 3, sell: 2, strong_sell: 1 };
const ACTION_REVERSE = { 5: 'strong_buy', 4: 'buy', 3: 'hold', 2: 'sell', 1: 'strong_sell' };
const IMPACT_MAP = { high: 3, medium: 2, low: 1 };

const BIAS_EMOJI = { bullish: '\u{1F7E2} Bullish', bearish: '\u{1F534} Bearish', neutral: '\u{1F7E1} Neutral' };
const IMPACT_EMOJI = { high: '\u{1F525} High', medium: '\u26A1 Medium', low: '\u{1F4A7} Low' };
const ACTION_EMOJI = {
  strong_buy: '\u{1F7E2} Strong Buy',
  buy: '\u{1F535} Buy',
  hold: '\u26AA Hold',
  sell: '\u{1F7E0} Sell',
  strong_sell: '\u{1F534} Strong Sell',
};
const RISK_EMOJI = { low: '\u{1F7E2} Low', medium: '\u{1F7E1} Medium', high: '\u{1F534} High' };

function computeConsensus(modelResponses) {
  const valid = modelResponses.filter(r =>
    r && r.bias && r.confidence != null && r.action && r.risk
  );

  if (valid.length === 0) {
    return { error: 'No valid model responses' };
  }

  // Single model: skip consensus, use directly
  if (valid.length === 1) {
    const r = valid[0];
    const score = r.confidence;
    return {
      ai_consensus_score: score,
      analysis_status: score >= 60 ? '\u2705 Analyzed' : '\u26A0\uFE0F Conflict',
      consensus_bias: BIAS_EMOJI[r.bias] || r.bias,
      consensus_impact: IMPACT_EMOJI[r.impact] || r.impact,
      recommended_action: ACTION_EMOJI[r.action] || r.action,
      risk_level: RISK_EMOJI[r.risk] || r.risk,
      consensus_symbols: r.symbols || [],
      consensus_confidence: r.confidence,
      bias_agreement: 100,
      model_count: 1,
      per_model_results: valid,
      consensus_reasoning: `Single model (${r.model || 'unknown'}): ${r.reasoning || ''}`,
    };
  }

  // Step 1: Bias consensus
  const biasCounts = { bullish: 0, bearish: 0, neutral: 0 };
  valid.forEach(r => { biasCounts[r.bias] = (biasCounts[r.bias] || 0) + 1; });
  const biasEntries = Object.entries(biasCounts).sort((a, b) => b[1] - a[1]);
  let winnerBias = biasEntries[0][0];
  let biasAgreement = (biasEntries[0][1] / valid.length) * 100;
  if (biasEntries.length >= 2 && biasEntries[0][1] === biasEntries[1][1] &&
      biasEntries[0][0] !== 'neutral' && biasEntries[1][0] !== 'neutral') {
    winnerBias = 'neutral';
  }

  // Step 2: Confidence
  const avgConfidence = valid.reduce((s, r) => s + r.confidence, 0) / valid.length;
  const finalConfidence = Math.round(avgConfidence * (biasAgreement / 100));

  // Step 3: Impact consensus
  const avgImpact = valid.reduce((s, r) => s + (IMPACT_MAP[r.impact] || 2), 0) / valid.length;
  const consensusImpact = avgImpact >= 2.5 ? 'high' : avgImpact >= 1.5 ? 'medium' : 'low';

  // Step 4: Action consensus (confidence-weighted)
  const totalConf = valid.reduce((s, r) => s + r.confidence, 0);
  const weightedAction = valid.reduce((s, r) => s + (ACTION_MAP[r.action] || 3) * r.confidence, 0) / totalConf;
  let consensusAction;
  if (weightedAction >= 4.5) consensusAction = 'strong_buy';
  else if (weightedAction >= 3.5) consensusAction = 'buy';
  else if (weightedAction >= 2.5) consensusAction = 'hold';
  else if (weightedAction >= 1.5) consensusAction = 'sell';
  else consensusAction = 'strong_sell';

  // Step 5: Risk (conservative max)
  const riskValues = valid.map(r => IMPACT_MAP[r.risk] || 2);
  const maxRisk = Math.max(...riskValues);
  const consensusRisk = maxRisk >= 3 ? 'high' : maxRisk >= 2 ? 'medium' : 'low';

  // Step 6: Symbol consensus
  const symbolFreq = {};
  valid.forEach(r => (r.symbols || []).forEach(s => { symbolFreq[s] = (symbolFreq[s] || 0) + 1; }));
  const threshold = valid.length * 0.5;
  let consensusSymbols = Object.entries(symbolFreq)
    .filter(([, count]) => count >= threshold)
    .map(([sym]) => sym);
  if (consensusSymbols.length === 0) {
    consensusSymbols = Object.entries(symbolFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sym]) => sym);
  }
  consensusSymbols = consensusSymbols.slice(0, 3);

  // Step 7: AI Consensus Score
  const actionAgreement = (valid.filter(r => r.action === consensusAction).length / valid.length) * 100;
  const aiConsensusScore = Math.round(biasAgreement * 0.4 + finalConfidence * 0.4 + actionAgreement * 0.2);

  // Step 8: Analysis Status
  let analysisStatus;
  if (aiConsensusScore >= 60) analysisStatus = '\u2705 Analyzed';
  else if (aiConsensusScore >= 40) analysisStatus = '\u26A0\uFE0F Conflict';
  else analysisStatus = '\u26A0\uFE0F Conflict';

  return {
    ai_consensus_score: aiConsensusScore,
    analysis_status: analysisStatus,
    consensus_bias: BIAS_EMOJI[winnerBias] || winnerBias,
    consensus_impact: IMPACT_EMOJI[consensusImpact] || consensusImpact,
    recommended_action: ACTION_EMOJI[consensusAction] || consensusAction,
    risk_level: RISK_EMOJI[consensusRisk] || consensusRisk,
    consensus_symbols: consensusSymbols,
    consensus_confidence: finalConfidence,
    bias_agreement: Math.round(biasAgreement),
    model_count: valid.length,
    per_model_results: valid,
    consensus_reasoning: `${valid.length} models: ${Math.round(biasAgreement)}% agree on ${winnerBias}. Action: ${consensusAction} (weighted score ${weightedAction.toFixed(1)}). Risk: ${consensusRisk} (conservative).`,
  };
}

// ── Format per-model results for Notion ─────────────────────────────

function formatPerModelText(consensus) {
  const date = new Date().toISOString().split('T')[0];
  let text = `=== AI Consensus Analysis ===\nScore: ${consensus.ai_consensus_score}/100 | Models: ${consensus.model_count} | Date: ${date}\n\n`;

  for (const r of consensus.per_model_results) {
    const model = r.model || 'Unknown';
    text += `[${model}] Bias: ${r.bias} | Conf: ${r.confidence}% | Action: ${r.action} | Risk: ${r.risk}\n`;
    if (r.reasoning) {
      text += `-> ${r.reasoning.slice(0, 200)}\n`;
    }
    text += '\n';
  }

  text += `Consensus: ${consensus.consensus_bias} | Action: ${consensus.recommended_action} | Risk: ${consensus.risk_level}\n`;
  if (consensus.consensus_symbols?.length) {
    text += `Symbols: ${consensus.consensus_symbols.join(', ')}\n`;
  }

  return text.slice(0, 2000);
}

// ── Build analysis prompt for a signal ──────────────────────────────

function buildPrompt(signal) {
  return `You are a professional financial analyst specializing in forex, commodities, and indices trading. Analyze the following news signal and provide a structured trading assessment.

## News Signal
- **Event**: ${signal.event}
- **Current Bias**: ${signal.bias}
- **Current Impact**: ${signal.impact}
- **Symbols**: ${(signal.symbols || []).join(', ')}
- **Time (ET)**: ${signal.time || 'N/A'}
- **Source**: ${signal.source || 'N/A'}
- **Source URL**: ${signal.url || 'N/A'}
- **Details**: ${signal.details || 'N/A'}

## Analysis Requirements
1. Assess whether the current bias (bullish/bearish/neutral) is correct
2. Evaluate the true market impact level
3. Determine the optimal trading action
4. Identify the risk level for trading this signal
5. Confirm or suggest better symbol assignments (max 3, ONLY from the allowed MT5 symbols list)
6. Provide clear reasoning for your assessment

## Allowed MT5 Symbols
Forex: EURUSD, GBPUSD, USDJPY, AUDUSD, NZDUSD, USDCAD, USDCHF, GBPJPY, EURJPY, EURGBP, AUDJPY, EURAUD
Indices: US500, US30, NAS100, DE40, UK100, JP225, FR40
Commodities: XAUUSD, XAGUSD, USOIL, UKOIL, NGAS
Crypto: BTCUSD, ETHUSD

## Response Format
Respond with ONLY a valid JSON object, no markdown, no explanation outside JSON:

{
  "bias": "bullish|bearish|neutral",
  "confidence": 0-100,
  "impact": "high|medium|low",
  "action": "strong_buy|buy|hold|sell|strong_sell",
  "risk": "low|medium|high",
  "symbols": ["SYMBOL1", "SYMBOL2"],
  "reasoning": "Your detailed analysis here (max 500 chars)",
  "key_levels": {
    "entry_zone": "description or N/A",
    "stop_loss": "description or N/A",
    "take_profit": "description or N/A"
  },
  "time_horizon": "intraday|swing|position",
  "catalysts": ["catalyst1", "catalyst2"]
}`;
}

// ── Ollama integration ──────────────────────────────────────────────

async function analyzeWithOllama(signal, model = 'llama3.2') {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const prompt = buildPrompt(signal);

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json',
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const content = data.message?.content;
  if (!content) throw new Error('Empty response from Ollama');

  const parsed = JSON.parse(content);
  parsed.model = `${model} (ollama)`;
  return parsed;
}

// ── Commands ────────────────────────────────────────────────────────

async function cmdPending() {
  const signals = await getNewSignals();
  // Also include signals with no analysis status
  const pending = signals.filter(s => !s.analysisStatus || s.analysisStatus === '\u23F3 Pending');
  console.log(JSON.stringify(pending, null, 2));
}

async function cmdAnalyze(pageId) {
  const signals = await getSignals({ pageSize: 100 });
  const signal = signals.find(s => s.id === pageId);
  if (!signal) {
    console.error(`Signal not found: ${pageId}`);
    process.exit(1);
  }
  console.log('=== Signal ===');
  console.log(JSON.stringify(signal, null, 2));
  console.log('\n=== Analysis Prompt ===');
  console.log(buildPrompt(signal));
}

async function cmdUpdate(pageId, analysisJson) {
  const modelResponses = Array.isArray(analysisJson) ? analysisJson : [analysisJson];
  const consensus = computeConsensus(modelResponses);

  if (consensus.error) {
    console.error('Consensus error:', consensus.error);
    process.exit(1);
  }

  const perModelText = formatPerModelText(consensus);

  await updateSignalAnalysis(pageId, {
    aiConsensusScore: consensus.ai_consensus_score,
    perModelResults: perModelText,
    analysisStatus: consensus.analysis_status,
    recommendedAction: consensus.recommended_action,
    riskLevel: consensus.risk_level,
    consensusBias: consensus.consensus_bias,
    consensusImpact: consensus.consensus_impact,
  });

  console.log(JSON.stringify({
    pageId,
    ...consensus,
    per_model_results: undefined,
    updated: true,
  }, null, 2));
}

async function cmdBatchUpdate(batchJson) {
  // Expected: [{ pageId, modelResponses: [...] }, ...]
  const results = [];
  for (const item of batchJson) {
    try {
      const modelResponses = item.modelResponses || [item];
      const consensus = computeConsensus(modelResponses);

      if (consensus.error) {
        results.push({ pageId: item.pageId, error: consensus.error });
        continue;
      }

      const perModelText = formatPerModelText(consensus);

      await updateSignalAnalysis(item.pageId, {
        aiConsensusScore: consensus.ai_consensus_score,
        perModelResults: perModelText,
        analysisStatus: consensus.analysis_status,
        recommendedAction: consensus.recommended_action,
        riskLevel: consensus.risk_level,
        consensusBias: consensus.consensus_bias,
        consensusImpact: consensus.consensus_impact,
      });

      results.push({
        pageId: item.pageId,
        ai_consensus_score: consensus.ai_consensus_score,
        analysis_status: consensus.analysis_status,
        recommended_action: consensus.recommended_action,
        risk_level: consensus.risk_level,
        updated: true,
      });
    } catch (err) {
      results.push({ pageId: item.pageId, error: err.message });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

async function cmdOllama(pageId) {
  const models = (process.env.OLLAMA_MODELS || 'llama3.2').split(',').map(m => m.trim());
  const signals = await getSignals({ pageSize: 100 });
  const signal = signals.find(s => s.id === pageId);

  if (!signal) {
    console.error(`Signal not found: ${pageId}`);
    process.exit(1);
  }

  const responses = [];
  for (const model of models) {
    try {
      console.error(`Analyzing with ${model}...`);
      const result = await analyzeWithOllama(signal, model);
      responses.push(result);
    } catch (err) {
      console.error(`${model} failed: ${err.message}`);
    }
  }

  if (responses.length === 0) {
    console.error('All models failed');
    process.exit(1);
  }

  await cmdUpdate(pageId, responses);
}

async function cmdStatus() {
  const signals = await getSignals({ pageSize: 100 });
  const stats = {
    total: signals.length,
    new: signals.filter(s => /new/i.test(s.status)).length,
    analyzed: signals.filter(s => s.analysisStatus === '\u2705 Analyzed').length,
    conflict: signals.filter(s => s.analysisStatus === '\u26A0\uFE0F Conflict').length,
    pending: signals.filter(s => !s.analysisStatus || s.analysisStatus === '\u23F3 Pending').length,
    byAction: {},
    byRisk: {},
  };

  signals.forEach(s => {
    if (s.recommendedAction) stats.byAction[s.recommendedAction] = (stats.byAction[s.recommendedAction] || 0) + 1;
    if (s.riskLevel) stats.byRisk[s.riskLevel] = (stats.byRisk[s.riskLevel] || 0) + 1;
  });

  console.log(JSON.stringify(stats, null, 2));
}

// ── Read stdin helper ───────────────────────────────────────────────

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`Invalid JSON on stdin: ${e.message}`));
      }
    });
    process.stdin.on('error', reject);
    // Timeout after 5s if no data
    setTimeout(() => {
      if (!data) reject(new Error('No data on stdin (timeout)'));
    }, 5000);
  });
}

// ── Main ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

(async () => {
  switch (command) {
    case '--pending':
      await cmdPending();
      break;

    case '--analyze':
      if (!args[1]) { console.error('Usage: --analyze <pageId>'); process.exit(1); }
      await cmdAnalyze(args[1]);
      break;

    case '--update':
      if (!args[1]) { console.error('Usage: --update <pageId> (pipe JSON via stdin)'); process.exit(1); }
      const updateData = await readStdin();
      await cmdUpdate(args[1], updateData);
      break;

    case '--batch-update':
      const batchData = await readStdin();
      await cmdBatchUpdate(batchData);
      break;

    case '--ollama':
      if (!args[1]) { console.error('Usage: --ollama <pageId>'); process.exit(1); }
      await cmdOllama(args[1]);
      break;

    case '--status':
      await cmdStatus();
      break;

    default:
      console.log(`Phase 2: Multi-Model AI Consensus Analysis

Usage:
  node analyze-signals.js --pending          List signals pending analysis
  node analyze-signals.js --analyze <id>     Output analysis prompt for a signal
  node analyze-signals.js --update <id>      Update signal with results (stdin JSON)
  node analyze-signals.js --batch-update     Batch update signals (stdin JSON array)
  node analyze-signals.js --ollama <id>      Auto-analyze with Ollama models
  node analyze-signals.js --status           Show analysis status summary`);
  }
})().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});

// Export for programmatic use
module.exports = { computeConsensus, formatPerModelText, buildPrompt, analyzeWithOllama };
