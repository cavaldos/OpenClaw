const axios = require('axios');
const cheerio = require('cheerio');
const { format, parse } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');

const FOREXFACTORY_URL = 'https://www.forexfactory.com/calendar';

const IMPACT_MAP = {
  low: 1,
  medium: 2,
  high: 3,
};

async function fetchForexFactory(date = null) {
  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    const targetDate = date || today;
    const url = `${FOREXFACTORY_URL}?day=${targetDate}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const events = [];
    const eventDate = targetDate;

    $('.calendar__row').each((_, row) => {
      const $row = $(row);
      
      const impact = $row.find('.calendar__impact').attr('data-impact') || 'low';
      const timeStr = $row.find('.calendar__time').text().trim();
      const title = $row.find('.calendar__event').text().trim();
      const currency = $row.find('.calendar__currency').text().trim();
      const actual = $row.find('.calendar__actual .first').text().trim();
      const forecast = $row.find('.calendar__forecast .first').text().trim();
      const previous = $row.find('.calendar__previous .first').text().trim();

      if (!title) return;

      const impactLevel = IMPACT_MAP[impact] || 1;
      let eventTime = null;
      
      if (timeStr && timeStr !== 'All Day' && timeStr !== '') {
        try {
          const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (timeParts) {
            let hours = parseInt(timeParts[1]);
            const minutes = parseInt(timeParts[2]);
            const period = timeParts[3].toUpperCase();
            
            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            
            const parsed = new Date();
            parsed.setHours(hours, minutes, 0, 0);
            eventTime = toZonedTime(parsed, 'America/New_York');
          }
        } catch (e) {
          console.log('Time parse error:', e.message);
        }
      }

      const timeValue = eventTime 
        ? format(eventTime, "yyyy-MM-dd'T'HH:mm:ssxxx")
        : eventDate;

      events.push({
        source: 'ForexFactory',
        sourceUrl: FOREXFACTORY_URL,
        title,
        currency,
        impact: impactLevel >= 3 ? 'High' : impactLevel >= 2 ? 'Medium' : 'Low',
        time: timeValue,
        actual,
        forecast,
        previous,
        raw: {
          impact,
          timeStr,
        },
      });
    });

    return events;
  } catch (error) {
    console.error('ForexFactory fetch error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
    return [];
  }
}

async function fetchToday() {
  return fetchForexFactory(format(new Date(), 'yyyy-MM-dd'));
}

async function fetchThisWeek() {
  const events = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayEvents = await fetchForexFactory(format(date, 'yyyy-MM-dd'));
    events.push(...dayEvents);
  }
  
  return events;
}

async function fetchByDateRange(startDate, endDate) {
  const events = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayEvents = await fetchForexFactory(format(d, 'yyyy-MM-dd'));
    events.push(...dayEvents);
  }
  
  return events;
}

module.exports = {
  fetchForexFactory,
  fetchToday,
  fetchThisWeek,
  fetchByDateRange,
  IMPACT_MAP,
};
