const { notion } = require('./index');

const DEFAULT_DATABASE_ID = 'b64498d9-1fdc-40dd-97ac-d17935103576';
const CONFIGURED_DATABASE_ID = process.env.NOTION_DATABASE_ID || '';
const DATABASE_ID = CONFIGURED_DATABASE_ID || DEFAULT_DATABASE_ID;
const NOTION_TOKEN = process.env.NOTION_TOKEN;

const PROPERTY_ALIASES = {
  event: ['Event', 'Ten su kien', 'Tên sự kiện', 'Name', 'Title'],
  symbol: ['Symbol', 'Ma co phieu', 'Mã cổ phiếu', 'Symbols'],
  time: ['Time (ET)', 'Thoi gian (US)', 'Thời gian (US)', 'Time'],
  bias: ['Bias'],
  impact: ['Impact', 'Muc do anh huong', 'Mức độ ảnh hưởng'],
  url: ['Source URL', 'Link lien quan', 'Link liên quan', 'Source'],
  details: ['Details', 'Thong tin chi tiet', 'Thông tin chi tiết', 'Description'],
  source: ['Source', 'Nguon tin', 'Nguồn tin'],
  status: ['Status', 'Trang thai', 'Trạng thái'],
  // Phase 2: Multi-Model Analysis columns
  aiConsensusScore: ['AI Consensus Score'],
  perModelResults: ['Per-Model Results'],
  analysisStatus: ['Analysis Status'],
  recommendedAction: ['Recommended Action'],
  riskLevel: ['Risk Level'],
  // Phase 3: Verification columns
  verificationStatus: ['Verification Status'],
  priceAtSignal: ['Price at Signal'],
  priceChange1D: ['Price Change 1D %'],
  priceChange3D: ['Price Change 3D %'],
  verificationScore: ['Verification Score'],
  verificationNotes: ['Verification Notes'],
};

let cachedSchema = null;

function hasNewsTradeFields(map) {
  return Boolean(
    map.symbol ||
    map.bias ||
    map.impact ||
    map.url ||
    map.details ||
    map.source ||
    map.status
  );
}

async function fetchDatabaseProperties(databaseId) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || `Unable to retrieve Notion schema for ${databaseId}`);
  }

  const payload = await response.json();
  return payload.properties || {};
}

function pickProperty(properties, aliases, expectedType) {
  const entries = Object.entries(properties || {});

  for (const alias of aliases) {
    const found = entries.find(([name, meta]) => {
      if (name.toLowerCase() !== alias.toLowerCase()) {
        return false;
      }
      return expectedType ? meta.type === expectedType : true;
    });

    if (found) {
      return found[0];
    }
  }

  if (!expectedType) {
    return null;
  }

  const byType = entries.find(([, meta]) => meta.type === expectedType);
  return byType ? byType[0] : null;
}

function buildSchema(properties, databaseId) {
  const map = {
    event: pickProperty(properties, PROPERTY_ALIASES.event, 'title'),
    symbol: pickProperty(properties, PROPERTY_ALIASES.symbol, 'multi_select'),
    time: pickProperty(properties, PROPERTY_ALIASES.time, 'date'),
    bias: pickProperty(properties, PROPERTY_ALIASES.bias, 'select'),
    impact: pickProperty(properties, PROPERTY_ALIASES.impact, 'select'),
    url: pickProperty(properties, PROPERTY_ALIASES.url, 'url'),
    details: pickProperty(properties, PROPERTY_ALIASES.details, 'rich_text'),
    source: pickProperty(properties, PROPERTY_ALIASES.source, 'select'),
    status: pickProperty(properties, PROPERTY_ALIASES.status, 'select'),
    // Phase 2 columns
    aiConsensusScore: pickProperty(properties, PROPERTY_ALIASES.aiConsensusScore, 'number'),
    perModelResults: pickProperty(properties, PROPERTY_ALIASES.perModelResults, 'rich_text'),
    analysisStatus: pickProperty(properties, PROPERTY_ALIASES.analysisStatus, 'select'),
    recommendedAction: pickProperty(properties, PROPERTY_ALIASES.recommendedAction, 'select'),
    riskLevel: pickProperty(properties, PROPERTY_ALIASES.riskLevel, 'select'),
    // Phase 3: Verification columns
    verificationStatus: pickProperty(properties, PROPERTY_ALIASES.verificationStatus, 'select'),
    priceAtSignal: pickProperty(properties, PROPERTY_ALIASES.priceAtSignal, 'number'),
    priceChange1D: pickProperty(properties, PROPERTY_ALIASES.priceChange1D, 'number'),
    priceChange3D: pickProperty(properties, PROPERTY_ALIASES.priceChange3D, 'number'),
    verificationScore: pickProperty(properties, PROPERTY_ALIASES.verificationScore, 'number'),
    verificationNotes: pickProperty(properties, PROPERTY_ALIASES.verificationNotes, 'rich_text'),
  };

  return {
    databaseId,
    properties,
    map,
  };
}

async function getSchema() {
  if (cachedSchema) {
    return cachedSchema;
  }

  const candidates = [...new Set([CONFIGURED_DATABASE_ID, DEFAULT_DATABASE_ID].filter(Boolean))];
  let lastError = null;

  for (const databaseId of candidates) {
    try {
      const properties = await fetchDatabaseProperties(databaseId);
      const schema = buildSchema(properties, databaseId);

      if (schema.map.event && hasNewsTradeFields(schema.map)) {
        cachedSchema = schema;
        return cachedSchema;
      }

      lastError = new Error(`Database ${databaseId} does not match News Trade Signals schema`);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message || 'Unable to resolve a valid News Trade Signals database');
}

async function queryDatabase(databaseId, body = {}) {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Unable to query Notion database');
  }

  return res.json();
}

async function addSignal({ event, symbols, time, bias, impact, url, details, source, status }) {
  const schema = await getSchema();

  if (!schema.map.event || !hasNewsTradeFields(schema.map)) {
    throw new Error('NOTION_DATABASE_ID is not a News Trade Signals schema. Please point to the News Trade Signals AMP database.');
  }

  const properties = {};

  properties[schema.map.event] = {
    title: [{ text: { content: event || 'Trading Event' } }],
  };

  if (schema.map.symbol && symbols?.length) {
    properties[schema.map.symbol] = {
      multi_select: symbols.map(symbol => ({ name: symbol.toUpperCase() })),
    };
  }

  if (schema.map.bias && bias) {
    properties[schema.map.bias] = { select: { name: bias } };
  }

  if (schema.map.time && time) {
    properties[schema.map.time] = {
      date: { start: time, time_zone: 'America/New_York' },
    };
  }

  if (schema.map.impact && impact) {
    properties[schema.map.impact] = { select: { name: impact } };
  }

  if (schema.map.url && url) {
    properties[schema.map.url] = { url };
  }

  if (schema.map.details && details) {
    properties[schema.map.details] = {
      rich_text: [{ text: { content: details.slice(0, 2000) } }],
    };
  }

  if (schema.map.source && source) {
    properties[schema.map.source] = { select: { name: source } };
  }

  if (schema.map.status) {
    properties[schema.map.status] = { select: { name: status || '📋 New' } };
  }

  return notion.pages.create({
    parent: { type: 'database_id', database_id: schema.databaseId },
    properties,
  });
}

function getPropertyValue(page, propName) {
  if (!propName) return null;

  const prop = page.properties[propName];
  if (!prop) return null;

  if (prop.type === 'title') {
    return prop.title?.[0]?.plain_text || '';
  }

  if (prop.type === 'multi_select') {
    return (prop.multi_select || []).map(item => item.name);
  }

  if (prop.type === 'date') {
    return prop.date?.start || null;
  }

  if (prop.type === 'select') {
    return prop.select?.name || '';
  }

  if (prop.type === 'url') {
    return prop.url || '';
  }

  if (prop.type === 'rich_text') {
    return prop.rich_text?.[0]?.plain_text || '';
  }

  if (prop.type === 'number') {
    return prop.number;
  }

  return null;
}

function parseSignal(page, schema) {
  return {
    id: page.id,
    event: getPropertyValue(page, schema.map.event) || '',
    symbols: getPropertyValue(page, schema.map.symbol) || [],
    time: getPropertyValue(page, schema.map.time),
    bias: getPropertyValue(page, schema.map.bias) || '',
    impact: getPropertyValue(page, schema.map.impact) || '',
    url: getPropertyValue(page, schema.map.url) || '',
    details: getPropertyValue(page, schema.map.details) || '',
    source: getPropertyValue(page, schema.map.source) || '',
    status: getPropertyValue(page, schema.map.status) || '',
    // Phase 2 fields
    aiConsensusScore: getPropertyValue(page, schema.map.aiConsensusScore),
    perModelResults: getPropertyValue(page, schema.map.perModelResults) || '',
    analysisStatus: getPropertyValue(page, schema.map.analysisStatus) || '',
    recommendedAction: getPropertyValue(page, schema.map.recommendedAction) || '',
    riskLevel: getPropertyValue(page, schema.map.riskLevel) || '',
    // Phase 3: Verification fields
    verificationStatus: getPropertyValue(page, schema.map.verificationStatus) || '',
    priceAtSignal: getPropertyValue(page, schema.map.priceAtSignal),
    priceChange1D: getPropertyValue(page, schema.map.priceChange1D),
    priceChange3D: getPropertyValue(page, schema.map.priceChange3D),
    verificationScore: getPropertyValue(page, schema.map.verificationScore),
    verificationNotes: getPropertyValue(page, schema.map.verificationNotes) || '',
  };
}

async function getSignals({ filter, sorts, pageSize = 20 } = {}) {
  const schema = await getSchema();
  const body = { page_size: pageSize };

  if (filter) {
    body.filter = filter;
  }

  if (sorts) {
    body.sorts = sorts;
  } else if (schema.map.time) {
    body.sorts = [{ property: schema.map.time, direction: 'descending' }];
  }

  let response;
  try {
    response = await queryDatabase(schema.databaseId, body);
  } catch (error) {
    const sortError = (error.message || '').toLowerCase().includes('sort property');
    if (sortError && body.sorts) {
      delete body.sorts;
      response = await queryDatabase(schema.databaseId, body);
    } else {
      throw error;
    }
  }

  return response.results.map(page => parseSignal(page, schema));
}

async function updateSignalStatus(pageId, status) {
  const schema = await getSchema();
  if (!schema.map.status) {
    throw new Error('Status property not found in target Notion database');
  }

  return notion.pages.update({
    page_id: pageId,
    properties: {
      [schema.map.status]: { select: { name: status } },
    },
  });
}

async function updateSignalAnalysis(pageId, analysisResult) {
  const schema = await getSchema();
  const properties = {};

  if (schema.map.aiConsensusScore && analysisResult.aiConsensusScore != null) {
    properties[schema.map.aiConsensusScore] = {
      number: analysisResult.aiConsensusScore,
    };
  }

  if (schema.map.perModelResults && analysisResult.perModelResults) {
    properties[schema.map.perModelResults] = {
      rich_text: [{ text: { content: String(analysisResult.perModelResults).slice(0, 2000) } }],
    };
  }

  if (schema.map.analysisStatus && analysisResult.analysisStatus) {
    properties[schema.map.analysisStatus] = {
      select: { name: analysisResult.analysisStatus },
    };
  }

  if (schema.map.recommendedAction && analysisResult.recommendedAction) {
    properties[schema.map.recommendedAction] = {
      select: { name: analysisResult.recommendedAction },
    };
  }

  if (schema.map.riskLevel && analysisResult.riskLevel) {
    properties[schema.map.riskLevel] = {
      select: { name: analysisResult.riskLevel },
    };
  }

  // Optionally update bias if consensus differs
  if (schema.map.bias && analysisResult.consensusBias) {
    properties[schema.map.bias] = {
      select: { name: analysisResult.consensusBias },
    };
  }

  // Optionally update impact if consensus differs
  if (schema.map.impact && analysisResult.consensusImpact) {
    properties[schema.map.impact] = {
      select: { name: analysisResult.consensusImpact },
    };
  }

  // Append consensus summary to details
  if (schema.map.details && analysisResult.detailsAppend) {
    properties[schema.map.details] = {
      rich_text: [{ text: { content: String(analysisResult.detailsAppend).slice(0, 2000) } }],
    };
  }

  if (Object.keys(properties).length === 0) {
    throw new Error('No valid Phase 2 properties to update');
  }

  return notion.pages.update({
    page_id: pageId,
    properties,
  });
}

async function updateSignalVerification(pageId, verificationResult) {
  const schema = await getSchema();
  const properties = {};

  if (schema.map.verificationStatus && verificationResult.verificationStatus) {
    properties[schema.map.verificationStatus] = {
      select: { name: verificationResult.verificationStatus },
    };
  }

  if (schema.map.priceAtSignal && verificationResult.priceAtSignal != null) {
    properties[schema.map.priceAtSignal] = {
      number: verificationResult.priceAtSignal,
    };
  }

  if (schema.map.priceChange1D && verificationResult.priceChange1D != null) {
    // Notion percent format: value 0.0027 displays as 0.27%
    properties[schema.map.priceChange1D] = {
      number: verificationResult.priceChange1D / 100,
    };
  }

  if (schema.map.priceChange3D && verificationResult.priceChange3D != null) {
    // Notion percent format: value 0.0027 displays as 0.27%
    properties[schema.map.priceChange3D] = {
      number: verificationResult.priceChange3D / 100,
    };
  }

  if (schema.map.verificationScore && verificationResult.verificationScore != null) {
    properties[schema.map.verificationScore] = {
      number: verificationResult.verificationScore,
    };
  }

  if (schema.map.verificationNotes && verificationResult.verificationNotes) {
    properties[schema.map.verificationNotes] = {
      rich_text: [{ text: { content: String(verificationResult.verificationNotes).slice(0, 2000) } }],
    };
  }

  if (Object.keys(properties).length === 0) {
    return null; // No verification properties in the database schema
  }

  return notion.pages.update({
    page_id: pageId,
    properties,
  });
}

async function getNewSignals() {
  const signals = await getSignals({ pageSize: 100 });
  return signals.filter(item => /new|moi/i.test(item.status || ''));
}

async function getBullishSignals() {
  const signals = await getSignals({ pageSize: 100 });
  return signals.filter(item => /bullish|tang/i.test(item.bias || ''));
}

async function getBearishSignals() {
  const signals = await getSignals({ pageSize: 100 });
  return signals.filter(item => /bearish|giam/i.test(item.bias || ''));
}

async function getResolvedDatabaseId() {
  const schema = await getSchema();
  return schema.databaseId;
}

module.exports = {
  DATABASE_ID,
  DEFAULT_DATABASE_ID,
  addSignal,
  getSignals,
  updateSignalStatus,
  updateSignalAnalysis,
  updateSignalVerification,
  getNewSignals,
  getBullishSignals,
  getBearishSignals,
  getResolvedDatabaseId,
  getSchema,
};

if (require.main === module) {
  (async () => {
    console.log('Querying signals...\n');
    const signals = await getSignals();
    console.log(`Found ${signals.length} signals:`);
    signals.forEach(signal => {
      console.log(`  - ${signal.event} | ${signal.symbols.join(', ')} | ${signal.bias} | ${signal.impact}`);
    });
  })();
}
