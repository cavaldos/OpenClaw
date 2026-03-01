# NewsTrade

Hệ thống thu thập tin tức tài chính, tạo tín hiệu giao dịch MT5 và lưu vào Notion.

## Cấu trúc

```
NewsTrade/
├── src/
│   ├── config.js                    # Cấu hình (API keys)
│   ├── index.js                     # Notion client
│   ├── news/
│   │   └── tavily.js               # Thu thập tin tức
│   ├── analysis/
│   │   └── signalGenerator.js      # Tạo tín hiệu trading
│   ├── db/
│   │   └── notion.js               # Thao tác Notion database
│   └── pipeline/
│       └── index.js                # Pipeline chính
├── scripts/                        # CLI commands
│   ├── collect-signals.js          # Thu thập & lưu tín hiệu
│   ├── query-signals.js            # Truy vấn tín hiệu
│   ├── analyze-signals.js          # Phân tích AI (Phase 2)
│   ├── verify-signals.js           # Xác minh với giá thực (Phase 3)
│   └── run-scheduler.js            # Chạy tự động
└── package.json
```

## Cài đặt

```bash
npm install
```

## Cấu hình

Tạo file `.env`:

```env
# Required
NOTION_TOKEN=your_notion_token
TAVILY_API_KEY=your_tavily_key

# Optional
NOTION_DATABASE_ID=your_database_id
```

## Sử dụng

### Phase 1: Thu thập tin tức & tạo tín hiệu

```bash
# Chạy thử (không lưu)
npm run signals:dry-run

# Thu thập và lưu vào Notion
npm run signals:collect
```

### Phase 2: Phân tích AI (multi-model)

```bash
# Xem trạng thái phân tích
npm run signals:status

# Phân tích với Ollama
node scripts/analyze-signals.js --ollama <pageId>
```

### Phase 3: Xác minh tín hiệu

```bash
# Xác minh tất cả tín hiệu
npm run signals:verify

# Xem báo cáo độ chính xác
npm run signals:verify-report

# Thống kê nhanh
npm run signals:verify-stats
```

### Scripts bổ sung

```bash
# Truy vấn tín hiệu
node scripts/query-signals.js [all|new|bullish|bearish]

# Thêm tín hiệu thủ công
node scripts/add-signal.js '{"event": "...", "symbols": ["EURUSD"]}'

# Cập nhật trạng thái
node scripts/update-status.js <pageId> "👀 Watching"

# Chạy tự động (cron)
npm run signals:schedule
```

## Tín hiệu & Giá trị

### Bias
- 🟢 Bullish - Giá dự kiến tăng
- 🔴 Bearish - Giá dự kiến giảm
- 🟡 Neutral - Chưa rõ ràng

### Impact
- 🔥 High - Fed, CPI, NFP, GDP, địa chính trị
- ⚡ Medium - Tin ngành, earnings, M&A
- 💧 Low - Tin nhỏ, ít tác động

### Symbols (MT5)
- Forex: EURUSD, GBPUSD, USDJPY, AUDUSD, ...
- Indices: US500, US30, NAS100, DE40, ...
- Commodities: XAUUSD, USOIL, ...
- Crypto: BTCUSD, ETHUSD

## API Keys

| Service | Required | Purpose |
|---------|----------|---------|
| Tavily | ✅ | Search tin tức |
| Notion | ✅ | Lưu trữ tín hiệu |
| Ollama | ❌ | Phân tích AI local |
| Frankfurter | ❌ | Verify giá forex |

## License

MIT
