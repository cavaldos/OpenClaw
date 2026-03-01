const axios = require('axios');

const FRANKFURTER_API = 'https://api.frankfurter.app';

/**
 * MT5 symbol -> Frankfurter base/quote mapping.
 * Only forex pairs supported by Frankfurter are included.
 */
const SYMBOL_MAP = {
  EURUSD: { base: 'EUR', quote: 'USD' },
  GBPUSD: { base: 'GBP', quote: 'USD' },
  USDJPY: { base: 'USD', quote: 'JPY' },
  EURGBP: { base: 'EUR', quote: 'GBP' },
  EURJPY: { base: 'EUR', quote: 'JPY' },
  AUDUSD: { base: 'AUD', quote: 'USD' },
  NZDUSD: { base: 'NZD', quote: 'USD' },
  USDCAD: { base: 'USD', quote: 'CAD' },
  USDCHF: { base: 'USD', quote: 'CHF' },
  GBPJPY: { base: 'GBP', quote: 'JPY' },
  AUDJPY: { base: 'AUD', quote: 'JPY' },
  EURAUD: { base: 'EUR', quote: 'AUD' },
};

/**
 * Check if a symbol is a verifiable forex pair.
 */
function isForexSymbol(symbol) {
  return Boolean(SYMBOL_MAP[(symbol || '').toUpperCase()]);
}

/**
 * Get verifiable forex symbols from a list of MT5 symbols.
 */
function filterForexSymbols(symbols) {
  return (symbols || []).filter(s => isForexSymbol(s));
}

/**
 * Fetch the exchange rate for a symbol on a specific date.
 * Frankfurter only has business-day data. If the date is a weekend/holiday,
 * the API returns the closest previous business day rate.
 *
 * @param {string} symbol - MT5 symbol (e.g. 'EURUSD')
 * @param {string} date   - Date string YYYY-MM-DD
 * @returns {Promise<{date: string, rate: number, base: string, quote: string} | null>}
 */
async function fetchPriceAtDate(symbol, date) {
  const pair = SYMBOL_MAP[(symbol || '').toUpperCase()];
  if (!pair) return null;

  try {
    const response = await axios.get(`${FRANKFURTER_API}/${date}`, {
      params: { from: pair.base, to: pair.quote },
      timeout: 10000,
    });

    const rate = response.data?.rates?.[pair.quote];
    if (rate == null) return null;

    return {
      date: response.data.date || date,
      rate,
      base: pair.base,
      quote: pair.quote,
    };
  } catch (error) {
    // Frankfurter returns 404 for dates before its data range
    if (error.response?.status === 404) return null;
    throw error;
  }
}

/**
 * Fetch rates for a symbol over a date range.
 *
 * @param {string} symbol    - MT5 symbol
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Array<{date: string, rate: number}>>}
 */
async function fetchPriceRange(symbol, startDate, endDate) {
  const pair = SYMBOL_MAP[(symbol || '').toUpperCase()];
  if (!pair) return [];

  try {
    const response = await axios.get(
      `${FRANKFURTER_API}/${startDate}..${endDate}`,
      {
        params: { from: pair.base, to: pair.quote },
        timeout: 15000,
      }
    );

    const rates = response.data?.rates || {};
    return Object.entries(rates)
      .map(([date, dayRates]) => ({
        date,
        rate: dayRates[pair.quote],
      }))
      .filter(r => r.rate != null)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (error) {
    if (error.response?.status === 404) return [];
    throw error;
  }
}

/**
 * Fetch prices at signal date and at T+1, T+3, T+7 business days.
 * Returns an object with all price points needed for verification.
 *
 * @param {string} symbol     - MT5 symbol
 * @param {string} signalDate - YYYY-MM-DD (the date the signal was created)
 * @returns {Promise<object|null>}
 */
async function fetchVerificationPrices(symbol, signalDate) {
  const pair = SYMBOL_MAP[(symbol || '').toUpperCase()];
  if (!pair) return null;

  // Fetch a range wide enough to cover T+0 through T+7 business days (~12 calendar days)
  const start = new Date(signalDate);
  const end = new Date(signalDate);
  end.setDate(end.getDate() + 12);

  const startStr = signalDate;
  const endStr = end.toISOString().split('T')[0];

  const prices = await fetchPriceRange(symbol, startStr, endStr);
  if (prices.length === 0) return null;

  // T+0: the first available date >= signalDate
  const t0 = prices[0];

  // T+1, T+3, T+7 are the 2nd, 4th, 8th available business day entries
  const t1 = prices.length > 1 ? prices[1] : null;
  const t3 = prices.length > 3 ? prices[3] : null;
  const t7 = prices.length > 7 ? prices[7] : null;

  return {
    symbol: symbol.toUpperCase(),
    base: pair.base,
    quote: pair.quote,
    signalDate,
    t0: t0 || null,
    t1: t1 || null,
    t3: t3 || null,
    t7: t7 || null,
  };
}

/**
 * Calculate the percentage change between two rates.
 */
function calcPctChange(rateFrom, rateTo) {
  if (!rateFrom || !rateTo || rateFrom === 0) return null;
  return ((rateTo - rateFrom) / rateFrom) * 100;
}

module.exports = {
  SYMBOL_MAP,
  isForexSymbol,
  filterForexSymbols,
  fetchPriceAtDate,
  fetchPriceRange,
  fetchVerificationPrices,
  calcPctChange,
};
