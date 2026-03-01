const ruleEngine = require('./ruleEngine');
const aiAnalyzer = require('./aiAnalyzer');

async function evaluateNews(newsItem, options = {}) {
  const { useAI = true, aiApiKey } = options;

  const ruleAnalysis = ruleEngine.applyRules(newsItem);
  const ruleRecommendation = ruleEngine.getTradingRecommendation(ruleAnalysis);

  let aiAnalysis = null;
  let combinedSignal = null;

  if (useAI && aiApiKey) {
    aiAnalysis = await aiAnalyzer.analyzeWithAI(newsItem, aiApiKey);
    combinedSignal = await aiAnalyzer.generateTradingSignal(aiAnalysis, ruleAnalysis);
  }

  return {
    news: newsItem,
    ruleAnalysis,
    ruleRecommendation,
    aiAnalysis,
    combinedSignal: combinedSignal || {
      finalBias: ruleAnalysis.bias,
      finalConfidence: ruleAnalysis.confidence,
      finalReason: ruleAnalysis.ruleMatches.map(m => m.rule).join(', ') || 'No clear signal',
      signals: [{
        source: 'Rules',
        bias: ruleAnalysis.bias,
        confidence: ruleAnalysis.confidence,
        reason: 'Based on rule engine analysis',
      }],
    },
    symbols: ruleAnalysis.symbols,
  };
}

async function evaluateNewsBatch(newsItems, options = {}) {
  const results = [];
  
  for (const item of newsItems) {
    const evaluation = await evaluateNews(item, options);
    results.push(evaluation);
    
    if (options.delay) {
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }
  }

  return results;
}

function filterByImpact(evaluatedNews, minImpact = 'Medium') {
  const impactOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
  const minLevel = impactOrder[minImpact];
  
  return evaluatedNews.filter(item => {
    const itemImpact = item.combinedSignal?.finalConfidence === 'High' 
      ? 'High' 
      : item.combinedSignal?.finalConfidence === 'Medium'
        ? 'Medium'
        : 'Low';
    return impactOrder[itemImpact] >= minLevel;
  });
}

function filterBySymbol(evaluatedNews, symbol) {
  const symbolUpper = symbol.toUpperCase();
  return evaluatedNews.filter(item => 
    item.symbols?.some(s => s.toUpperCase() === symbolUpper)
  );
}

function filterByBias(evaluatedNews, bias) {
  return evaluatedNews.filter(item => 
    item.combinedSignal?.finalBias === bias
  );
}

function getTradingOpportunities(evaluatedNews) {
  if (!evaluatedNews || !Array.isArray(evaluatedNews)) {
    return [];
  }
  
  return evaluatedNews
    .filter(item => {
      const bias = item.combinedSignal?.finalBias;
      const confidence = item.combinedSignal?.finalConfidence;
      return (bias === 'Tăng' || bias === 'Giảm') &&
        (confidence === 'High' || confidence === 'Medium');
    })
    .map(item => ({
      title: item.news.title,
      symbol: (item.symbols && item.symbols[0]) || item.news.currency || 'N/A',
      bias: item.combinedSignal.finalBias,
      confidence: item.combinedSignal.finalConfidence,
      reason: item.combinedSignal.finalReason,
      source: item.news.source,
      time: item.news.time || item.news.publishedAt,
    }));
}

module.exports = {
  evaluateNews,
  evaluateNewsBatch,
  filterByImpact,
  filterBySymbol,
  filterByBias,
  getTradingOpportunities,
};
