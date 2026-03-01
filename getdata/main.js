const axios = require('axios');
const fs = require('fs');
const path = require('path');

const FRANKFURTER_API = 'https://api.frankfurter.app';

async function fetchForexOHLC({
  base = 'EUR',
  symbols = ['USD', 'GBP', 'JPY'],
  startDate,
  endDate,
  outputDir = path.join(__dirname, 'data')
}) {
  if (!startDate || !endDate) {
    throw new Error('startDate and endDate are required (format: YYYY-MM-DD)');
  }

  const symbolList = Array.isArray(symbols) ? symbols.join(',') : symbols;

  console.log(`Fetching forex data: ${base}/${symbolList} from ${startDate} to ${endDate}`);

  try {
    const response = await axios.get(
      `${FRANKFURTER_API}/${startDate}..${endDate}`,
      {
        params: {
          from: base,
          to: symbolList
        }
      }
    );

    const data = response.data;
    
    if (!data.rates) {
      throw new Error('No data returned from API');
    }

    const ohlcData = parseRatesToOHLC(data, base, symbols);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${base}_${symbolList}_${timestamp}.csv`;
    const filepath = path.join(outputDir, filename);

    saveToCSV(ohlcData, filepath);

    console.log(`Saved ${ohlcData.length} records to ${filepath}`);
    
    return {
      success: true,
      data: ohlcData,
      filepath
    };

  } catch (error) {
    console.error('Error fetching data:', error.message);
    throw error;
  }
}

function parseRatesToOHLC(data, base, symbols) {
  const rates = data.rates;
  const result = [];

  for (const [date, dayRates] of Object.entries(rates)) {
    for (const [currency, rate] of Object.entries(dayRates)) {
      result.push({
        Date: date,
        Base: base,
        Symbol: currency,
        Open: rate,
        High: rate,
        Low: rate,
        Close: rate
      });
    }
  }

  result.sort((a, b) => new Date(a.Date) - new Date(b.Date));

  return result;
}

function saveToCSV(data, filepath) {
  const headers = ['Date', 'Base', 'Symbol', 'Open', 'High', 'Low', 'Close'];
  const rows = data.map(row => 
    headers.map(h => row[h]).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(filepath, csv, 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: node main.js <base> <symbols> <startDate> <endDate> [outputDir]

Example: 
  node main.js EUR "USD,GBP" 2024-01-01 2025-01-01
  node main.js USD JPY 2024-01-01 2024-12-31 ./data

Parameters:
  base       - Base currency (e.g., EUR, USD)
  symbols    - Target currencies comma-separated (e.g., USD,GBP,JPY)
  startDate  - Start date (YYYY-MM-DD)
  endDate    - End date (YYYY-MM-DD)
  outputDir  - Optional: output directory (default: ./data)
`);
    return;
  }

  const [base, symbols, startDate, endDate, outputDir] = args;

  await fetchForexOHLC({
    base,
    symbols: symbols.split(','),
    startDate,
    endDate,
    outputDir
  });
}

module.exports = { fetchForexOHLC };

if (require.main === module) {
  main().catch(console.error);
}
