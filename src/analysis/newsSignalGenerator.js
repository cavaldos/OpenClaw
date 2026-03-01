const { formatInTimeZone } = require('date-fns-tz');

const BIAS = {
  bullish: '🟢 Bullish',
  bearish: '🔴 Bearish',
  neutral: '🟡 Neutral',
};

const IMPACT = {
  high: '🔥 High',
  medium: '⚡ Medium',
  low: '💧 Low',
};

const MT5_SYMBOL_RULES = [
  { regex: /\b(fed|federal reserve|us cpi|nfp|payroll|us gdp|pce)\b/i, symbols: ['US500', 'XAUUSD', 'EURUSD'] },
  { regex: /\b(ecb|euro area|eu inflation|germany)\b/i, symbols: ['EURUSD', 'DE40'] },
  { regex: /\b(boe|uk cpi|uk gdp|britain|british)\b/i, symbols: ['GBPUSD', 'UK100'] },
  { regex: /\b(boj|japan|japanese|yen)\b/i, symbols: ['USDJPY', 'JP225'] },
  { regex: /\b(oil|wti|brent|opec|crude)\b/i, symbols: ['USOIL', 'UKOIL'] },
  { regex: /\b(gold|safe haven|bullion)\b/i, symbols: ['XAUUSD', 'USDJPY'] },
  { regex: /\b(silver)\b/i, symbols: ['XAGUSD'] },
  { regex: /\b(nasdaq|chip|ai stocks|tech stocks)\b/i, symbols: ['NAS100', 'US500'] },
  { regex: /\b(s&p 500|dow jones|wall street|risk sentiment)\b/i, symbols: ['US500', 'US30'] },
  { regex: /\b(bitcoin|btc|crypto etf|crypto regulation)\b/i, symbols: ['BTCUSD'] },
  { regex: /\b(ethereum|eth)\b/i, symbols: ['ETHUSD'] },
];

const BULLISH_KEYWORDS = [
  'beats',
  'beat',
  'stronger',
  'cooling inflation',
  'rate cuts',
  'dovish',
  'deal reached',
  'ceasefire',
  'surge in demand',
  'upgrades outlook',
  'stimulus',
  'soft landing',
];

const BEARISH_KEYWORDS = [
  'misses',
  'miss',
  'hotter inflation',
  'rate hike',
  'hawkish',
  'sanctions',
  'escalation',
  'war risk',
  'downgrade',
  'recession risk',
  'capital outflow',
  'default risk',
];

const HIGH_IMPACT_KEYWORDS = [
  'federal reserve',
  'fed',
  'ecb',
  'boe',
  'boj',
  'cpi',
  'nfp',
  'nonfarm payroll',
  'gdp',
  'pce',
  'interest rate',
  'opec',
  'war',
  'sanction',
];

const MEDIUM_IMPACT_KEYWORDS = [
  'earnings',
  'guidance',
  'manufacturing pmi',
  'services pmi',
  'retail sales',
  'bond yields',
  'treasury auction',
  'etf flows',
];

function toEtDateTime(dateInput) {
  const parsed = dateInput ? new Date(dateInput) : new Date();
  const validDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return formatInTimeZone(validDate, 'America/New_York', "yyyy-MM-dd'T'HH:mm:ss");
}

function inferSymbols(text) {
  const found = [];

  for (const rule of MT5_SYMBOL_RULES) {
    if (rule.regex.test(text)) {
      found.push(...rule.symbols);
    }
  }

  if (found.length === 0) {
    found.push('US500', 'XAUUSD');
  }

  return [...new Set(found)].slice(0, 3);
}

function inferBias(text) {
  let bullishScore = 0;
  let bearishScore = 0;

  for (const kw of BULLISH_KEYWORDS) {
    if (text.includes(kw)) bullishScore += 1;
  }

  for (const kw of BEARISH_KEYWORDS) {
    if (text.includes(kw)) bearishScore += 1;
  }

  if (bullishScore > bearishScore) return BIAS.bullish;
  if (bearishScore > bullishScore) return BIAS.bearish;
  return BIAS.neutral;
}

function inferImpact(text) {
  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (text.includes(kw)) return IMPACT.high;
  }

  for (const kw of MEDIUM_IMPACT_KEYWORDS) {
    if (text.includes(kw)) return IMPACT.medium;
  }

  return IMPACT.low;
}

function getConfidenceLabel(bias, impact) {
  if (impact === IMPACT.high && bias !== BIAS.neutral) return 'High';
  if (impact === IMPACT.medium) return 'Medium';
  return 'Low';
}

function normalizeSource(source) {
  const normalized = (source || '').trim();
  if (['Reuters', 'Bloomberg', 'CNBC', 'WSJ', 'Fed'].includes(normalized)) {
    return normalized;
  }
  return 'Other';
}

function buildDetails(newsItem, signalParts) {
  const description = (newsItem.description || '').trim();
  const cleanDescription = description.length > 700 ? `${description.slice(0, 700)}...` : description;

  return [
    `Prediction: ${signalParts.bias} with ${signalParts.impact} impact (${signalParts.confidence} confidence).`,
    `Why: Signal inferred from macro keywords and source context in the headline/content.`,
    `Focus symbols: ${signalParts.symbols.join(', ')}.`,
    cleanDescription ? `Context: ${cleanDescription}` : null,
    'Risk note: Reversal risk if follow-up data or official statements contradict initial headlines.',
  ].filter(Boolean).join(' ');
}

function toSignal(newsItem) {
  const text = `${newsItem.title || ''} ${newsItem.description || ''}`.toLowerCase();
  const symbols = inferSymbols(text);
  const bias = inferBias(text);
  const impact = inferImpact(text);
  const confidence = getConfidenceLabel(bias, impact);

  const signal = {
    event: (newsItem.title || 'Untitled market event').slice(0, 120),
    symbols,
    time: toEtDateTime(newsItem.publishedAt),
    bias,
    impact,
    url: newsItem.sourceUrl,
    source: normalizeSource(newsItem.source),
    status: '📋 New',
  };

  signal.details = buildDetails(newsItem, {
    symbols,
    bias,
    impact,
    confidence,
  });

  return signal;
}

function generateSignals(newsItems, options = {}) {
  const minImpact = options.minImpact || IMPACT.medium;
  const maxSignals = options.maxSignals || 20;
  const impactOrder = { [IMPACT.high]: 3, [IMPACT.medium]: 2, [IMPACT.low]: 1 };
  const threshold = impactOrder[minImpact] || 2;

  return (newsItems || [])
    .map(item => toSignal(item))
    .filter(signal => impactOrder[signal.impact] >= threshold)
    .slice(0, maxSignals);
}

module.exports = {
  BIAS,
  IMPACT,
  MT5_SYMBOL_RULES,
  toSignal,
  generateSignals,
};
