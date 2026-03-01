# NewsTrade AI Model Guide

This document is a universal runbook for any AI model/agent to operate this project safely and consistently.

## 1) Project Purpose

NewsTrade collects global macro/market news, generates trade signals, and stores them in a Notion database. It supports a **two-phase workflow**:

**Phase 1 — News Collection:**
1. Fetch news from Tavily.
2. Generate signals (bias, impact, symbols, details, ET time).
3. Save to Notion (with duplicate prevention by source URL).

**Phase 2 — Multi-Model AI Analysis:**
4. Read pending signals from Notion.
5. Send each signal to multiple AI models (Ollama local, OpenAI, Claude, etc.).
6. Run consensus voting algorithm across model responses.
7. Update Notion with consensus score, recommended action, and risk level.

Full Phase 2 details: see `.agents/skills/news-trade-analysis/SKILL.md` (section "Phase 2: Multi-Model AI Consensus Analysis").

## 2) Environment Requirements

- Node.js `>= 18`
- npm
- Internet access
- Valid Notion integration token
- Valid Tavily API key

### Phase 2 Additional Requirements (optional)
- Ollama installed and running locally (for local model analysis)
- Or any cloud API key: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`

## 3) Required Environment Variables

Create `.env` in repository root.

Required:
- `NOTION_TOKEN`
- `TAVILY_API_KEY` (or `TAVILY` as legacy fallback)

Optional:
- `NOTION_DATABASE_ID`

Notes:
- If `NOTION_DATABASE_ID` is missing or not compatible, code can fallback to the default AMP database.
- Never print or expose secrets in logs.

## 4) Install Dependencies

```bash
npm install
```

## 5) Canonical Commands

### Dry run (no Notion write)

```bash
npm run signals:dry-run -- --max-signals 5 --fetch-limit 20
```

### Collect and save to Notion

```bash
npm run signals:collect -- --min-impact medium --max-signals 10 --fetch-limit 30
```

### Query saved signals

```bash
node .agents/skills/news-trade-analysis/scripts/query-signals.js all
node .agents/skills/news-trade-analysis/scripts/query-signals.js bullish
node .agents/skills/news-trade-analysis/scripts/query-signals.js bearish
```

### Run scheduler (every 30 minutes)

```bash
npm run signals:schedule -- "*/30 * * * *" medium
```

## 6) Expected Script Output Contract

`collect-signals.js` returns JSON:

```json
{
  "success": true,
  "mode": "dry-run|save",
  "databaseId": "string|null",
  "fetchedCount": 0,
  "generatedCount": 0,
  "savedCount": 0,
  "skippedCount": 0,
  "topSignals": []
}
```

AI agents must:
- Parse JSON output.
- Treat `success: false` as failure.
- Report concise failure reason.
- Never claim data was saved when `savedCount` is `0`.

## 7) Signal Semantics

### Phase 1 Values

Bias values:
- `🟢 Bullish`
- `🔴 Bearish`
- `🟡 Neutral`

Impact values:
- `🔥 High`
- `⚡ Medium`
- `💧 Low`

Status default:
- `📋 New`

MT5 symbol assignment:
- Max 3 symbols per signal.
- Use direct impact mapping only.

### Phase 2 Values (Multi-Model Analysis)

Analysis Status:
- `⏳ Pending` — awaiting analysis
- `✅ Analyzed` — consensus complete (score >= 60%)
- `⚠️ Conflict` — models disagree (score < 60%)
- `🔄 Re-analyze` — flagged for re-analysis

Recommended Action:
- `🟢 Strong Buy`, `🔵 Buy`, `⚪ Hold`, `🟠 Sell`, `🔴 Strong Sell`

Risk Level:
- `🟢 Low`, `🟡 Medium`, `🔴 High`

AI Consensus Score:
- 0-100 integer. >= 75 is strong, 60-74 moderate, < 60 conflict.

## 8) Notion Behavior

- Writes are handled in `src/news-trade-db.js`.
- Schema is resolved dynamically using property aliases.
- Duplicate prevention is based on source URL in pipeline.
- If schema mismatch occurs, the system attempts fallback to default AMP database.
- Phase 2 adds 5 new columns: `AI Consensus Score`, `Per-Model Results`, `Analysis Status`, `Recommended Action`, `Risk Level`.
- Phase 2 updates are done via Notion page patch (update existing pages, do not create new ones).

## 9) Safe Operating Rules for AI Agents

1. Run dry-run before first save in a session.
2. Validate `success` and counts before reporting completion.
3. Do not hardcode credentials.
4. Do not modify `.env` automatically unless explicitly asked.
5. Do not use mock data for production claims.
6. Keep details text concise and under Notion rich text limits.
7. On errors, return actionable fix steps (missing key, Notion access, schema mismatch).

## 10) Troubleshooting

### Error: `TAVILY_API_KEY is not configured`
- Add `TAVILY_API_KEY` (or `TAVILY`) to `.env`.

### Error: Notion validation/property mismatch
- Verify `NOTION_DATABASE_ID` points to News Trade Signals AMP-like schema.
- Ensure integration has access to the database.

### Error: No signals generated
- Increase `--fetch-limit`.
- Lower threshold with `--min-impact low`.
- Re-run later (news cycle may be quiet).

## 11) Minimal AI Execution Recipe

### Phase 1 Only (News Collection)

Use this exact sequence:

1. `npm install`
2. `npm run signals:dry-run -- --max-signals 5 --fetch-limit 20`
3. If dry-run success and output looks valid, run:
   - `npm run signals:collect -- --min-impact medium --max-signals 10 --fetch-limit 30`
4. Verify with:
   - `node .agents/skills/news-trade-analysis/scripts/query-signals.js all`

### Full Pipeline (Phase 1 + Phase 2)

1. `npm install`
2. `npm run signals:collect -- --min-impact medium --max-signals 10 --fetch-limit 30`
3. Query pending signals: `node .agents/skills/news-trade-analysis/scripts/query-signals.js new`
4. For each pending signal:
   a. Build the Analysis Prompt (see SKILL.md "Analysis Prompt Template")
   b. Send to each configured model (Ollama, cloud APIs)
   c. Parse JSON responses, validate schema
   d. Run Consensus Voting Algorithm (see SKILL.md)
   e. Update Notion page with consensus results
5. Report: X signals analyzed, Y high-confidence, Z conflicts
6. Verify: `node .agents/skills/news-trade-analysis/scripts/query-signals.js all`

## 12) File Map (Important)

- Tavily fetch: `src/news/tavily.js`
- Signal generation: `src/analysis/newsSignalGenerator.js`
- End-to-end pipeline: `src/pipeline/newsTradePipeline.js`
- Notion DB integration: `src/news-trade-db.js`
- AI analyzer (single model): `src/analysis/aiAnalyzer.js`
- Rule engine: `src/analysis/ruleEngine.js`
- Evaluator (combined): `src/analysis/evaluator.js`
- Skill scripts: `.agents/skills/news-trade-analysis/scripts/`
- Skill definition (Phase 1 + Phase 2): `.agents/skills/news-trade-analysis/SKILL.md`

---

If you are an AI model, follow this guide as the source of truth for operations in this repo. For Phase 2 multi-model analysis details, refer to SKILL.md.
