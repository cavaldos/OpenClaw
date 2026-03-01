const RULES = {
  centralBank: {
    patterns: [
      { regex: /fed(eral reserve)?/i, currency: 'USD', type: 'central_bank' },
      { regex: /ecb|european central bank/i, currency: 'EUR', type: 'central_bank' },
      { regex: /boe|bank of england/i, currency: 'GBP', type: 'central_bank' },
      { regex: /boj|bank of japan/i, currency: 'JPY', type: 'central_bank' },
      { regex: /rba|reserve bank of australia/i, currency: 'AUD', type: 'central_bank' },
      { regex: /boc|bank of canada/i, currency: 'CAD', type: 'central_bank' },
      { regex: /snb|swiss national bank/i, currency: 'CHF', type: 'central_bank' },
      { regex: /pboc|people.?s bank of china/i, currency: 'CNY', type: 'central_bank' },
    ],
    rules: {
      rate_hike: {
        keywords: ['rate hike', 'raise rates', 'increase rates', 'tightening', 'hawkish'],
        bias: 'Giảm',
        confidence: 'High',
        impact: 'High',
      },
      rate_cut: {
        keywords: ['rate cut', 'lower rates', 'ease', 'dovish', 'cut rates'],
        bias: 'Tăng',
        confidence: 'High',
        impact: 'High',
      },
      rate_hold: {
        keywords: ['hold rates', 'keep rates', 'unchanged', 'maintain'],
        bias: 'Neutral',
        confidence: 'Medium',
        impact: 'Medium',
      },
      dovish: {
        keywords: ['dovish', 'more dovish', 'concerned', 'cautious'],
        bias: 'Tăng',
        confidence: 'Medium',
        impact: 'Medium',
      },
      hawkish: {
        keywords: ['hawkish', 'more hawkish', 'confident', 'inflation concerns'],
        bias: 'Giảm',
        confidence: 'Medium',
        impact: 'Medium',
      },
    },
  },
  economic: {
    patterns: [
      { regex: /gdp/i, type: 'gdp' },
      { regex: /cpi|consumer price index|inflation/i, type: 'inflation' },
      { regex: /pce|personal consumption/i, type: 'inflation' },
      { regex: /unemployment|nfp|nonfarm/i, type: 'employment' },
      { regex: /retail sales|consumer spending/i, type: 'consumer' },
      { regex: /pmi|purchasing manager/i, type: 'pmi' },
      { regex: /trade balance|exports|imports/i, type: 'trade' },
    ],
    rules: {
      gdp_higher: {
        keywords: ['gdp higher', 'gdp beats', 'gdp grows', 'expansion'],
        bias: 'Tăng',
        confidence: 'High',
        impact: 'High',
      },
      gdp_lower: {
        keywords: ['gdp lower', 'gdp misses', 'contracts', 'recession'],
        bias: 'Giảm',
        confidence: 'High',
        impact: 'High',
      },
      inflation_higher: {
        keywords: ['inflation rises', 'inflation higher', 'hotter', 'accelerates'],
        bias: 'Giảm',
        confidence: 'High',
        impact: 'High',
      },
      inflation_lower: {
        keywords: ['inflation falls', 'cools', 'disinflation', 'eases'],
        bias: 'Tăng',
        confidence: 'High',
        impact: 'High',
      },
      employment_good: {
        keywords: ['employment rises', 'jobs growth', 'unemployment falls'],
        bias: 'Tăng',
        confidence: 'High',
        impact: 'High',
      },
      employment_weak: {
        keywords: ['job losses', 'unemployment rises', 'weak hiring'],
        bias: 'Giảm',
        confidence: 'High',
        impact: 'High',
      },
    },
  },
  geoPolitical: {
    patterns: [
      { regex: /trade war|tariff/i, type: 'trade_war' },
      { regex: /sanction/i, type: 'sanction' },
      { regex: /war|conflict|military/i, type: 'conflict' },
      { regex: /election/i, type: 'election' },
    ],
    rules: {
      trade_war_escalates: {
        keywords: ['tariff increases', 'trade war escalates', 'new tariffs'],
        bias: 'Giảm',
        confidence: 'High',
        impact: 'High',
      },
      trade_deal: {
        keywords: ['trade deal', 'trade agreement', 'tariff relief'],
        bias: 'Tăng',
        confidence: 'Medium',
        impact: 'Medium',
      },
      sanction: {
        keywords: ['sanction', 'sanctions'],
        bias: 'Giảm',
        confidence: 'Medium',
        impact: 'High',
      },
    },
  },
};

function applyRules(newsItem) {
  const result = {
    title: newsItem.title,
    description: newsItem.description || '',
    source: newsItem.source,
    sourceUrl: newsItem.sourceUrl || newsItem.source,
    time: newsItem.time || newsItem.publishedAt,
    impact: newsItem.impact || 'Medium',
    symbols: [],
    bias: 'Neutral',
    confidence: 'Low',
    ruleMatches: [],
  };

  const text = (newsItem.title + ' ' + (newsItem.description || '')).toLowerCase();

  for (const [category, categoryData] of Object.entries(RULES)) {
    let categoryMatched = false;
    
    for (const pattern of categoryData.patterns || []) {
      if (pattern.regex.test(text)) {
        categoryMatched = true;
        if (pattern.currency) {
          result.symbols.push(pattern.currency);
        }
        
        let hasKeywordMatch = false;
        
        for (const [ruleName, rule] of Object.entries(categoryData.rules)) {
          const matchedKeywords = rule.keywords.filter(keyword => text.includes(keyword));
          if (matchedKeywords.length > 0) {
            hasKeywordMatch = true;
            result.ruleMatches.push({
              category,
              rule: ruleName,
              matchedKeywords,
              confidence: rule.confidence,
              impact: rule.impact,
              suggestedBias: rule.bias,
            });

            if (rule.confidence === 'High') {
              result.bias = rule.bias;
              result.confidence = rule.confidence;
              result.impact = rule.impact;
            } else if (result.confidence !== 'High') {
              result.bias = rule.bias;
              result.confidence = rule.confidence;
              result.impact = rule.impact;
            }
          }
        }

        if (!hasKeywordMatch && category === 'centralBank') {
          const rateDecisionKeywords = ['rate decision', 'interest rate', 'monetary policy'];
          const hasRateDecision = rateDecisionKeywords.some(kw => text.includes(kw));
          
          if (hasRateDecision) {
            result.ruleMatches.push({
              category,
              rule: 'rate_decision_pending',
              matchedKeywords: rateDecisionKeywords,
              confidence: 'Medium',
              impact: 'High',
              suggestedBias: 'Neutral',
            });
            
            if (result.confidence !== 'High') {
              result.confidence = 'Medium';
              result.impact = 'High';
            }
          }
        }

        if (!hasKeywordMatch && category === 'economic') {
          if (result.confidence !== 'High') {
            result.confidence = 'Medium';
            result.impact = 'High';
          }
        }
      }
    }
  }

  if (result.symbols.length === 0) {
    const currencyMatches = text.match(/\b(usd|eur|gbp|jpy|aud|cad|chf|cny|btc|eth)\b/gi);
    if (currencyMatches) {
      result.symbols = [...new Set(currencyMatches.map(c => c.toUpperCase()))];
    }
  }

  if (result.symbols.length > 0 && result.confidence === 'Low' && result.ruleMatches.length === 0) {
    if (result.impact === 'High') {
      result.confidence = 'Medium';
    }
  }

  return result;
}

function applyRulesBatch(newsItems) {
  return newsItems.map(item => applyRules(item));
}

function getTradingRecommendation(analysis) {
  const recommendations = [];

  for (const match of analysis.ruleMatches) {
    recommendations.push({
      action: match.suggestedBias === 'Tăng' ? 'BUY' : match.suggestedBias === 'Giảm' ? 'SELL' : 'WAIT',
      symbol: analysis.symbols[0] || 'N/A',
      reason: match.category + ': ' + match.rule,
      confidence: match.confidence,
      impact: match.impact,
    });
  }

  return recommendations;
}

module.exports = {
  applyRules,
  applyRulesBatch,
  getTradingRecommendation,
  RULES,
};
