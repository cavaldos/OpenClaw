const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

async function getActivePages() {
  try {
    const response = await notion.search({
      filter: {
        value: 'page',
        property: 'object',
      },
      page_size: 100,
    });

    const pages = response.results.filter(page => 
      page.parent.type === 'workspace' || page.parent.type === 'database_id'
    );

    console.log(`Found ${pages.length} pages:\n`);
    pages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.properties.Name?.title[0]?.plain_text || 'Untitled'}`);
      console.log(`   ID: ${page.id}`);
      console.log(`   Created: ${page.created_time}`);
      console.log(`   Last edited: ${page.last_edited_time}\n`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getActivePages();
