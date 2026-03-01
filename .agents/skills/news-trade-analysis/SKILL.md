---
name: news-trade-analysis
description: "Analyze global financial news with Tavily, generate MT5 trading signals, and save to Notion database News Trade Signals AMP. Supports multi-model AI consensus analysis for higher accuracy. Use when asked to gather world news, produce forecasts, or manage the News Trade Signals database."
---

# News Trade Analysis

Skill to analyze financial news and generate trading signals for MT5, stored in a Notion database. Supports **two-phase workflow**: Phase 1 collects news and saves raw signals, Phase 2 runs multi-model AI analysis for higher-accuracy consensus scoring.

---

## Notion Database

- **Database**: News Trade Signals AMP (schema-compatible)
- **ID**: `b64498d9-1fdc-40dd-97ac-d17935103576`
- **URL**: https://www.notion.so/b64498d91fdc40dd97acd17935103576

### Schema (Core — Phase 1)

| Column | Type | Description |
|--------|------|-------------|
| Event | Title | News event name |
| Symbol | Multi-select | MT5 tradeable symbols (see list below) |
| Time (ET) | Date | Event time (timezone America/New_York) |
| Bias | Select | `🟢 Bullish` / `🔴 Bearish` / `🟡 Neutral` |
| Impact | Select | `🔥 High` / `⚡ Medium` / `💧 Low` |
| Source URL | URL | Link to the original article |
| Details | Rich text | Detailed analysis, reasoning, trade strategy |
| Source | Select | `Reuters` / `Bloomberg` / `CNBC` / `WSJ` / `Fed` / `Other` |
| Status | Select | `📋 New` / `👀 Watching` / `✅ Traded` / `⏭️ Skipped` |

### Schema (Extended — Phase 2: Multi-Model Analysis)

| Column | Type | Description |
|--------|------|-------------|
| AI Consensus Score | Number (0-100) | Consensus agreement percentage across all models |
| Per-Model Results | Rich text | JSON summary of each model's individual analysis |
| Analysis Status | Select | `⏳ Pending` / `✅ Analyzed` / `⚠️ Conflict` / `🔄 Re-analyze` |
| Recommended Action | Select | `🟢 Strong Buy` / `🔵 Buy` / `⚪ Hold` / `🟠 Sell` / `🔴 Strong Sell` |
| Risk Level | Select | `🟢 Low` / `🟡 Medium` / `🔴 High` |

### MT5 Symbols (ONLY use these)

**Forex:**
EURUSD, GBPUSD, USDJPY, AUDUSD, NZDUSD, USDCAD, USDCHF, GBPJPY, EURJPY, EURGBP, AUDJPY, EURAUD

**Indices:**
US500 (S&P 500), US30 (Dow Jones), NAS100 (Nasdaq 100), DE40 (DAX), UK100 (FTSE), JP225 (Nikkei), FR40 (CAC 40)

**Commodities:**
XAUUSD (Gold), XAGUSD (Silver), USOIL (WTI Crude), UKOIL (Brent), NGAS (Natural Gas)

**Crypto:**
BTCUSD, ETHUSD

### Symbol Selection Rules
- Only assign symbols that are DIRECTLY affected by the news
- Max 3 symbols per signal — pick the most impacted ones
- Fed/CPI/GDP/Jobs data -> US500, XAUUSD, EURUSD
- Oil news -> USOIL
- Gold/safe-haven news -> XAUUSD
- EUR-specific news -> EURUSD, DE40
- GBP-specific news -> GBPUSD, UK100
- JPY-specific news -> USDJPY, JP225
- Tech/AI earnings -> NAS100
- Broad US market news -> US500, US30
- Crypto regulation/adoption -> BTCUSD

---

## Workflow Overview

```
Phase 1: News Collection          Phase 2: Multi-Model Analysis
========================          ================================
Tavily/RSS/Scraper                Read signals (Analysis Status: Pending)
       |                                     |
  Generate Signals                  Send to Model 1 (e.g. GPT-4o)
       |                           Send to Model 2 (e.g. Claude)
  Save to Notion                    Send to Model 3 (e.g. Ollama)
  (Status: New)                              |
  (Analysis Status: Pending)        Consensus Voting Algorithm
                                             |
                                    Update Notion with results
                                    (Analysis Status: Analyzed)
```

---

## Phase 1: News Collection (Existing Pipeline)

### Step 1: Gather News
Use Tavily search to collect latest market-moving news from:
- Reuters, Bloomberg, CNBC, WSJ, MarketWatch
- Fed announcements, ECB, central banks
- Economic data releases

```bash
node .agents/skills/news-trade-analysis/scripts/collect-signals.js --dry-run
```

### Step 2: Analyze (Keyword-Based)
For each significant news item:
1. **Event**: Brief summary
2. **Symbol**: Pick 1-3 MT5 symbols most directly affected
3. **Bias**: Bullish/Bearish/Neutral based on expectations vs actual
4. **Impact**: High (macro events) / Medium (sector) / Low (minor)
5. **Time**: US Eastern Time
6. **Details**: Analysis including reasoning, key levels, risks

### Step 3: Save to Notion

```bash
node .agents/skills/news-trade-analysis/scripts/collect-signals.js --save --min-impact medium
```

Manual insert:

```bash
node .agents/skills/news-trade-analysis/scripts/add-signal.js '{
  "event": "Fed holds rates at 5.5%",
  "symbols": ["US500", "XAUUSD", "EURUSD"],
  "time": "2026-02-26T14:00:00",
  "bias": "🟢 Bullish",
  "impact": "🔥 High",
  "url": "https://reuters.com/...",
  "details": "Fed holds rates, dot plot shows 3 cuts in 2026.",
  "source": "Reuters"
}'
```

### Step 4: Query Signals

```bash
node .agents/skills/news-trade-analysis/scripts/query-signals.js all
node .agents/skills/news-trade-analysis/scripts/query-signals.js new
node .agents/skills/news-trade-analysis/scripts/query-signals.js bullish
node .agents/skills/news-trade-analysis/scripts/query-signals.js bearish
```

### Step 5: Update Status

```bash
node .agents/skills/news-trade-analysis/scripts/update-status.js <pageId> "👀 Watching"
```

### Step 6: Auto Run (Optional)

```bash
node .agents/skills/news-trade-analysis/scripts/run-scheduler.js "*/30 * * * *" medium
```

---

## Phase 2: Multi-Model AI Consensus Analysis

This phase takes signals saved in Notion (from Phase 1) and runs them through **multiple AI models** in parallel. Each model independently analyzes the news and produces a structured assessment. Results are then combined using a **consensus voting algorithm** to produce a final recommendation with higher accuracy than any single model.

### Why Multi-Model?
- Different models have different strengths (reasoning, data recency, language understanding)
- Consensus reduces single-model hallucination and bias
- Disagreement between models flags uncertain signals for manual review
- Confidence scoring is more calibrated when averaged across models

### Step-by-Step Execution

#### Step 2.1: Read Pending Signals from Notion

Query all signals where `Analysis Status` is `⏳ Pending` (or signals where `Analysis Status` column is empty, meaning they were created before Phase 2 was added).

```bash
node .agents/skills/news-trade-analysis/scripts/query-signals.js new
```

For each signal, extract: `Event`, `Details`, `Symbol`, `Bias`, `Impact`, `Source URL`, `Time (ET)`.

#### Step 2.2: Send to Each AI Model

For each pending signal, send the **Analysis Prompt** (see below) to every configured model. Each model MUST return a structured JSON response.

**Supported model providers (use any combination):**

| Provider | Model Examples | API Endpoint |
|----------|---------------|--------------|
| OpenAI | gpt-4o, gpt-4o-mini, o1, o3-mini | `https://api.openai.com/v1/chat/completions` |
| Anthropic | claude-sonnet-4-20250514, claude-opus-4-20250514 | `https://api.anthropic.com/v1/messages` |
| Google | gemini-2.0-flash, gemini-2.5-pro | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| DeepSeek | deepseek-chat, deepseek-reasoner | `https://api.deepseek.com/v1/chat/completions` |
| Groq | llama-3.3-70b, mixtral-8x7b | `https://api.groq.com/openai/v1/chat/completions` |
| Ollama (local) | llama3.2, qwen2.5, mistral, phi3 | `http://localhost:11434/api/chat` |
| OpenRouter | any model via unified API | `https://openrouter.ai/api/v1/chat/completions` |

#### Step 2.3: Collect and Parse Responses

Each model returns structured JSON (see Analysis Prompt below). Parse each response and validate:
- `bias` must be one of: `bullish`, `bearish`, `neutral`
- `confidence` must be 0-100
- `impact` must be one of: `high`, `medium`, `low`
- `action` must be one of: `strong_buy`, `buy`, `hold`, `sell`, `strong_sell`
- `risk` must be one of: `low`, `medium`, `high`
- `symbols` must only contain valid MT5 symbols from the list above
- `reasoning` must be a non-empty string

If a model returns invalid or unparseable output, exclude it from consensus but log the failure.

#### Step 2.4: Run Consensus Voting Algorithm

See **Consensus Algorithm** section below for full details.

#### Step 2.5: Update Notion with Results

For each analyzed signal, update the Notion page with:

| Field | Value |
|-------|-------|
| AI Consensus Score | Computed consensus percentage (0-100) |
| Per-Model Results | JSON string of all model responses (see format below) |
| Analysis Status | `✅ Analyzed` if consensus >= 60%, `⚠️ Conflict` if < 60% |
| Recommended Action | Consensus action mapped to Notion select values |
| Risk Level | Consensus risk level mapped to Notion select values |
| Bias | Updated if consensus bias differs from Phase 1 keyword-based bias |
| Impact | Updated if consensus impact differs from Phase 1 |
| Details | Append consensus summary to existing details |

---

## Analysis Prompt Template

Use this EXACT prompt for every model. Replace `{variables}` with actual signal data.

```
You are a professional financial analyst specializing in forex, commodities, and indices trading. Analyze the following news signal and provide a structured trading assessment.

## News Signal
- **Event**: {event}
- **Current Bias**: {bias}
- **Current Impact**: {impact}
- **Symbols**: {symbols}
- **Time (ET)**: {time}
- **Source**: {source}
- **Source URL**: {source_url}
- **Details**: {details}

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
}
```

### Prompt Notes
- The prompt is designed to work with any LLM (cloud or local)
- For Ollama/local models, you may need to add `"format": "json"` in the API request to enforce JSON output
- For weaker models, you can simplify by removing `key_levels`, `time_horizon`, and `catalysts` fields
- Always validate the JSON response before using it

---

## Consensus Voting Algorithm

Given N model responses for a single signal, compute consensus as follows:

### Input
Array of valid model responses, each containing: `bias`, `confidence`, `impact`, `action`, `risk`, `symbols`, `reasoning`

### Step 1: Bias Consensus
```
1. Count votes: bullish_count, bearish_count, neutral_count
2. Winner = bias with most votes
3. bias_agreement = winner_count / total_models * 100
4. If tie between bullish and bearish -> bias = "neutral", flag as conflict
```

### Step 2: Confidence Score
```
1. consensus_confidence = average of all model confidence values
2. Weight by bias agreement: final_confidence = consensus_confidence * (bias_agreement / 100)
3. Round to integer
```

### Step 3: Impact Consensus
```
1. Map: high=3, medium=2, low=1
2. average_impact = average of all model impact scores
3. If average >= 2.5 -> "high"
4. If average >= 1.5 -> "medium"
5. Else -> "low"
```

### Step 4: Action Consensus
```
1. Map: strong_buy=5, buy=4, hold=3, sell=2, strong_sell=1
2. weighted_action = sum(model_action_score * model_confidence) / sum(model_confidence)
3. If weighted_action >= 4.5 -> "strong_buy"
4. If weighted_action >= 3.5 -> "buy"
5. If weighted_action >= 2.5 -> "hold"
6. If weighted_action >= 1.5 -> "sell"
7. Else -> "strong_sell"
```

### Step 5: Risk Consensus
```
1. Map: high=3, medium=2, low=1
2. Take the MAX risk across all models (conservative approach)
3. If any model says "high" -> "high"
4. If any model says "medium" -> "medium"
5. Else -> "low"
```

### Step 6: Symbol Consensus
```
1. Count frequency of each symbol across all model responses
2. Keep symbols that appear in >= 50% of model responses
3. If no symbol meets threshold, keep top 3 by frequency
4. Max 3 symbols
```

### Step 7: AI Consensus Score (final)
```
ai_consensus_score = round(bias_agreement * 0.4 + final_confidence * 0.4 + action_agreement * 0.2)

Where action_agreement = (count of models matching consensus action) / total_models * 100
```

### Step 8: Analysis Status
```
If ai_consensus_score >= 75 -> "✅ Analyzed" (high confidence)
If ai_consensus_score >= 60 -> "✅ Analyzed" (moderate confidence)
If ai_consensus_score >= 40 -> "⚠️ Conflict" (low agreement, needs review)
If ai_consensus_score < 40  -> "⚠️ Conflict" (strong disagreement, manual review required)
```

### Consensus Output Format
```json
{
  "ai_consensus_score": 82,
  "analysis_status": "✅ Analyzed",
  "consensus_bias": "🟢 Bullish",
  "consensus_impact": "🔥 High",
  "recommended_action": "🔵 Buy",
  "risk_level": "🟡 Medium",
  "consensus_symbols": ["US500", "XAUUSD"],
  "consensus_confidence": 78,
  "bias_agreement": 100,
  "model_count": 3,
  "per_model_results": [
    {
      "model": "gpt-4o",
      "bias": "bullish",
      "confidence": 85,
      "action": "buy",
      "risk": "medium",
      "reasoning": "..."
    },
    {
      "model": "claude-sonnet",
      "bias": "bullish",
      "confidence": 75,
      "action": "buy",
      "risk": "medium",
      "reasoning": "..."
    },
    {
      "model": "llama3.2 (ollama)",
      "bias": "bullish",
      "confidence": 72,
      "action": "hold",
      "risk": "high",
      "reasoning": "..."
    }
  ],
  "consensus_reasoning": "3/3 models agree on bullish bias. 2/3 recommend buy, 1 recommends hold with higher risk assessment. Strong consensus on US500 and XAUUSD as primary instruments.",
  "key_levels_summary": "Entry near current levels, stop loss below recent support, TP at next resistance.",
  "analyzed_at": "2026-03-01T14:30:00-05:00"
}
```

---

## Per-Model Results Format (for Notion Rich Text)

Store in `Per-Model Results` column as formatted text:

```
=== AI Consensus Analysis ===
Score: 82/100 | Models: 3 | Date: 2026-03-01

[GPT-4o] Bias: Bullish | Conf: 85% | Action: Buy | Risk: Medium
-> Fed dovish pivot supports equities, gold as hedge.

[Claude Sonnet] Bias: Bullish | Conf: 75% | Action: Buy | Risk: Medium
-> Rate cut expectations priced in, but momentum favors upside.

[Llama 3.2] Bias: Bullish | Conf: 72% | Action: Hold | Risk: High
-> Bullish but volatility risk elevated near FOMC.

Consensus: BULLISH (100% agreement) | Action: BUY | Risk: MEDIUM
Symbols: US500, XAUUSD
```

---

## Ollama Local Model Setup

### Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama server
ollama serve
```

### Pull Recommended Models

```bash
# Best for financial analysis (pick 1-2)
ollama pull llama3.2        # 3B params, fast, good reasoning
ollama pull qwen2.5:7b      # 7B params, strong multilingual + analysis
ollama pull mistral:7b       # 7B params, good general reasoning
ollama pull phi3:medium      # 14B params, strong reasoning (needs more RAM)
ollama pull deepseek-r1:7b   # 7B params, strong reasoning chain
```

### Verify Ollama is Running

```bash
curl http://localhost:11434/api/tags
# Should return list of installed models
```

### Ollama API Call Example

```bash
curl -s http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    {
      "role": "user",
      "content": "<INSERT ANALYSIS PROMPT HERE>"
    }
  ],
  "stream": false,
  "format": "json"
}' | jq '.message.content'
```

### Ollama Performance Notes
- 7B models: ~2-5 seconds per analysis on M1/M2 Mac (8GB+ RAM)
- 14B models: ~5-15 seconds, needs 16GB+ RAM
- 3B models: ~1-2 seconds, lower quality but good for fast screening
- Use `"format": "json"` to force JSON output
- If JSON parsing fails, retry once with explicit instruction to output only JSON

---

## Notion Value Mappings (Phase 2)

### Analysis Status
- `⏳ Pending` — awaiting multi-model analysis
- `✅ Analyzed` — consensus analysis complete (score >= 60%)
- `⚠️ Conflict` — models disagree significantly (score < 60%), needs manual review
- `🔄 Re-analyze` — manually flagged for re-analysis (data may have changed)

### Recommended Action
- `🟢 Strong Buy` — high consensus bullish with strong confidence
- `🔵 Buy` — moderate consensus bullish
- `⚪ Hold` — neutral or mixed signals
- `🟠 Sell` — moderate consensus bearish
- `🔴 Strong Sell` — high consensus bearish with strong confidence

### Risk Level
- `🟢 Low` — models agree, clear direction, low volatility expected
- `🟡 Medium` — some disagreement or moderate volatility expected
- `🔴 High` — significant disagreement, high volatility, or major event risk

### AI Consensus Score Interpretation
- **90-100**: Very strong consensus. High-confidence trade signal.
- **75-89**: Strong consensus. Reliable signal, normal position sizing.
- **60-74**: Moderate consensus. Consider reduced position size.
- **40-59**: Weak consensus (Conflict). Do NOT trade. Review manually.
- **0-39**: Strong disagreement. Skip this signal entirely.

---

## Phase 2 CLI Commands

### Analyze all pending signals with multi-model

```bash
# Agent-driven: query pending signals, then run analysis prompt for each
node .agents/skills/news-trade-analysis/scripts/query-signals.js new
# Then for each signal, agent sends prompt to configured models and updates Notion
```

### Re-analyze a specific signal

```bash
node .agents/skills/news-trade-analysis/scripts/update-status.js <pageId> "🔄 Re-analyze"
# Then run the analysis flow again for signals with "Re-analyze" status
```

### Full Two-Phase Pipeline (Agent Execution Recipe)

```
1. Phase 1 — Collect news and save to Notion:
   npm run signals:collect -- --min-impact medium --max-signals 10

2. Phase 2 — Multi-model analysis:
   a. Query new/pending signals from Notion
   b. For each signal:
      i.   Build the Analysis Prompt with signal data
      ii.  Send to Model 1 (e.g. Ollama llama3.2) -> parse JSON
      iii. Send to Model 2 (e.g. Ollama qwen2.5) -> parse JSON
      iv.  Send to Model 3 (optional, e.g. cloud API) -> parse JSON
      v.   Run Consensus Voting Algorithm
      vi.  Update Notion page with consensus results
   c. Report summary: X signals analyzed, Y high-confidence, Z conflicts

3. Review — Check results:
   node .agents/skills/news-trade-analysis/scripts/query-signals.js all
```

---

## Environment Variables

### Required (Phase 1)
- `NOTION_TOKEN` — Notion integration token
- `TAVILY_API_KEY` (or `TAVILY`) — Tavily search API key

### Optional (Phase 2 — Cloud Models)
- `OPENAI_API_KEY` — for GPT-4o, GPT-4o-mini
- `ANTHROPIC_API_KEY` — for Claude Sonnet, Opus
- `GOOGLE_AI_API_KEY` — for Gemini models
- `DEEPSEEK_API_KEY` — for DeepSeek models
- `GROQ_API_KEY` — for Groq (Llama, Mixtral)
- `OPENROUTER_API_KEY` — for OpenRouter (any model)

### Optional (Phase 2 — Local Models)
- `OLLAMA_BASE_URL` — Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODELS` — comma-separated list of models to use (default: `llama3.2`)

### Optional
- `NOTION_DATABASE_ID` — override default database ID

---

## Exact Values Reference

### Bias
- `🟢 Bullish` — price expected to rise
- `🔴 Bearish` — price expected to fall
- `🟡 Neutral` — unclear, needs monitoring

### Impact
- `🔥 High` — Fed, CPI, NFP, GDP, geopolitical shock
- `⚡ Medium` — sector news, earnings, M&A
- `💧 Low` — minor data, limited market impact

### Source
- `Reuters`, `Bloomberg`, `CNBC`, `WSJ`, `Fed`, `Other`

### Status
- `📋 New`, `👀 Watching`, `✅ Traded`, `⏭️ Skipped`

---

## Important Notes

### Phase 1
- ONLY use MT5 tradeable symbols listed above
- Max 3 symbols per signal
- Time MUST be US Eastern timezone
- Details max 2000 characters
- Avoid duplicate events (dedupe by Source URL)
- Requires `TAVILY_API_KEY` and `NOTION_TOKEN` in `.env`
- Supports Tavily env keys: `TAVILY_API_KEY` or `TAVILY`

### Phase 2
- Minimum 2 models recommended for meaningful consensus, 3+ is ideal
- Always validate JSON responses from models before including in consensus
- Exclude unparseable/invalid model responses from consensus (log the failure)
- If only 1 model is available, skip consensus and use that model's output directly (set AI Consensus Score = model confidence, Analysis Status = `✅ Analyzed`)
- Per-Model Results field has a 2000-char Notion limit — truncate reasoning if needed
- For Ollama models, ensure the server is running before analysis
- Cloud API keys are optional — the system works with Ollama-only (zero cost)
- Re-analysis: change Analysis Status to `🔄 Re-analyze` to re-process a signal
- Never auto-trade based on AI analysis alone — signals are for human decision support

### Safety Rules for AI Agents
1. Run Phase 1 dry-run before first save in a session
2. Validate model JSON responses strictly against the expected schema
3. Do not hardcode credentials or API keys
4. Do not modify `.env` automatically unless explicitly asked
5. Log all model calls and responses for audit trail
6. On consensus conflict (score < 60%), flag for human review — do NOT recommend action
7. Report the number of models used and their agreement level in every analysis summary
8. If a model API call fails, continue with remaining models — do not abort the entire analysis

---

## File Map

- Tavily fetch: `src/news/tavily.js`
- Signal generation: `src/analysis/newsSignalGenerator.js`
- End-to-end pipeline: `src/pipeline/newsTradePipeline.js`
- Notion DB integration: `src/news-trade-db.js`
- AI analyzer (single model): `src/analysis/aiAnalyzer.js`
- Rule engine: `src/analysis/ruleEngine.js`
- Evaluator (combined): `src/analysis/evaluator.js`
- Skill scripts: `.agents/skills/news-trade-analysis/scripts/`
- Skill definition: `.agents/skills/news-trade-analysis/SKILL.md`
