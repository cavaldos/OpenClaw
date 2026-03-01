# NewsTrade - Agent Guide

For AI coding agents (OpenCode, Claude Code, VSCode, etc.)

## Quick Start

```bash
# Install dependencies
npm install

# Run full pipeline (Phase 1 + Phase 3)
npm run signals:collect
npm run signals:verify
```

## Available Commands

| Command | Description | AI Required |
|---------|-------------|-------------|
| `npm run signals:dry-run` | Test without saving | ❌ |
| `npm run signals:collect` | Collect & save signals to Notion | ❌ |
| `npm run signals:verify` | Verify signals with real prices | ❌ |
| `npm run signals:verify-report` | Accuracy report | ❌ |
| `npm run signals:status` | Show analysis status | ❌ |

## Environment Variables

Create `.env`:
```
NOTION_TOKEN=your_token
TAVILY_API_KEY=your_key
```

## What It Does

1. **Phase 1**: Fetches financial news → generates trading signals → saves to Notion
2. **Phase 2** (optional): AI analysis with Ollama
3. **Phase 3**: Verifies signals against real forex prices

## For Agents

Just run these commands in sequence:
```bash
npm run signals:collect
npm run signals:verify
npm run signals:verify-report
```

No manual setup needed beyond `.env` file.
