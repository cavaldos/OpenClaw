const { Client } = require('@notionhq/client');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env'), quiet: true });

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DEFAULT_DATABASE = '313f312eab258019a665c331ec1743cf';

async function addNewsEvent(eventData) {
  const dbId = process.env.NOTION_DATABASE_ID || DEFAULT_DATABASE;
  
  const properties = {
    'Name': {
      title: [{ text: { content: eventData.title?.substring(0, 100) || 'Trading Event' } }],
    },
  };

  try {
    const db = await notion.databases.retrieve({ database_id: dbId });
    const dbProps = Object.keys(db.properties || {});
    
    if (dbProps.includes('Symbol') && eventData.symbols) {
      properties['Symbol'] = { multi_select: eventData.symbols.map(s => ({ name: s })) };
    }
    if (dbProps.includes('Bias') && eventData.bias) {
      properties['Bias'] = { select: { name: eventData.bias } };
    }
    if (dbProps.includes('Time') && eventData.time) {
      properties['Time'] = { date: { start: eventData.time } };
    }
    if (dbProps.includes('Source') && eventData.source) {
      properties['Source'] = { url: eventData.source };
    }
    if (dbProps.includes('Description') && eventData.description) {
      properties['Description'] = { rich_text: [{ text: { content: eventData.description } }] };
    }
  } catch (e) {
    console.log('DB properties error:', e.message);
  }

  const response = await notion.pages.create({
    parent: { database_id: dbId },
    properties: properties,
  });

  return response;
}

async function getNewsEvents(options = {}) {
  const dbId = process.env.NOTION_DATABASE_ID || DEFAULT_DATABASE;
  
  try {
    const response = await notion.databases.query({
      database_id: dbId,
      page_size: options.limit || 50,
    });
    return response.results;
  } catch (e) {
    return [];
  }
}

async function deleteNewsEvent(pageId) {
  const response = await notion.pages.update({
    page_id: pageId,
    archived: true,
  });
  return response;
}

module.exports = {
  notion,
  addNewsEvent,
  getNewsEvents,
  deleteNewsEvent,
};
