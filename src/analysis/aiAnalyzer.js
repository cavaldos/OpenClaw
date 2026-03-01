const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const ANALYSIS_PROMPT = `Bạn là một chuyên gia phân tích tin tức tài chính và trading. Hãy phân tích tin tức dưới đây và đưa ra:

1. ** Tăng (Bias**:bullish) / Giảm (bearish) / Neutral
2. **Độ tin cậy**: High / Medium / Low  
3. **Impact**: High / Medium / Low
4. **Symbols**: Các mã tiền tệ/cổ phiếu bị ảnh hưởng
5. **Lý do**: Giải thích ngắn gọn tại sao

Định dạng JSON:
{
  "bias": "Tăng/Giảm/Neutral",
  "confidence": "High/Medium/Low",
  "impact": "High/Medium/Low", 
  "symbols": ["USD", "EUR"],
  "reason": "..."
}

Tin tức: {newsContent}`;

async function analyzeWithAI(newsItem, openaiApiKey = OPENAI_API_KEY) {
  if (!openaiApiKey) {
    console.warn('OpenAI API key not configured, skipping AI analysis');
    return null;
  }

  try {
    const { Configuration, OpenAIApi } = require('openai');
    const configuration = new Configuration({ apiKey: openaiApiKey });
    const openai = new OpenAIApi(configuration);

    const content = `Title: ${newsItem.title}\nDescription: ${newsItem.description || ''}`;
    const prompt = ANALYSIS_PROMPT.replace('{newsContent}', content);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Bạn là chuyên gia phân tích tin tức tài chính. Trả lời JSON hợp lệ.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const resultText = response.choices[0].message.content;
    const result = JSON.parse(resultText);

    return {
      ...result,
      analyzedWith: 'AI',
    };
  } catch (error) {
    console.error('AI Analysis error:', error.message);
    return null;
  }
}

async function analyzeBatchWithAI(newsItems, openaiApiKey = OPENAI_API_KEY) {
  if (!openaiApiKey) {
    return newsItems.map(item => ({ ...item, aiAnalysis: null }));
  }

  const results = [];
  
  for (const item of newsItems) {
    const analysis = await analyzeWithAI(item, openaiApiKey);
    results.push({
      ...item,
      aiAnalysis: analysis,
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

async function generateTradingSignal(analysis, ruleBasedAnalysis) {
  const signals = [];

  const ruleBias = ruleBasedAnalysis?.bias || 'Neutral';
  const ruleConfidence = ruleBasedAnalysis?.confidence || 'Low';
  
  if (analysis?.bias) {
    signals.push({
      source: 'AI',
      bias: analysis.bias,
      confidence: analysis.confidence,
      impact: analysis.impact,
      reason: analysis.reason,
    });
  }

  signals.push({
    source: 'Rules',
    bias: ruleBias,
    confidence: ruleConfidence,
    impact: ruleBasedAnalysis?.impact || 'Medium',
    reason: ruleBasedAnalysis?.ruleMatches?.map(m => m.rule).join(', ') || 'No rule match',
  });

  const highConfidenceSignals = signals.filter(s => s.confidence === 'High');
  
  let finalBias = 'Neutral';
  let finalConfidence = 'Low';
  let finalReason = '';

  if (highConfidenceSignals.length > 0) {
    const bullishCount = highConfidenceSignals.filter(s => s.bias === 'Tăng').length;
    const bearishCount = highConfidenceSignals.filter(s => s.bias === 'Giảm').length;
    
    if (bullishCount > bearishCount) {
      finalBias = 'Tăng';
      finalConfidence = 'High';
    } else if (bearishCount > bullishCount) {
      finalBias = 'Giảm';
      finalConfidence = 'High';
    }
    
    finalReason = highConfidenceSignals.map(s => `${s.source}: ${s.reason}`).join(' | ');
  } else {
    const mediumSignals = signals.filter(s => s.confidence === 'Medium');
    if (mediumSignals.length > 0) {
      finalBias = mediumSignals[0].bias;
      finalConfidence = 'Medium';
      finalReason = mediumSignals.map(s => `${s.source}: ${s.reason}`).join(' | ');
    }
  }

  return {
    finalBias,
    finalConfidence,
    finalReason,
    signals,
  };
}

module.exports = {
  analyzeWithAI,
  analyzeBatchWithAI,
  generateTradingSignal,
  ANALYSIS_PROMPT,
};
