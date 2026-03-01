const { Client } = require('@notionhq/client');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

async function getActivePages() {
  const response = await notion.search({
    filter: { value: 'page', property: 'object' },
    page_size: 100,
  });
  return response.results;
}

async function getPage(pageId) {
  return await notion.pages.retrieve({ page_id: pageId });
}

async function getPageContent(pageId) {
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  return blocks.results;
}

async function createPage(parentId, title, content = []) {
  const properties = {
    Name: {
      title: [{ text: { content: title } }],
    },
  };

  const children = content.map(block => {
    if (typeof block === 'string') {
      return { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: block } }] } };
    }
    return block;
  });

  if (parentId === 'workspace') {
    return await notion.pages.create({ properties, children });
  }
  return await notion.pages.create({ parent: { page_id: parentId }, properties, children });
}

async function updatePage(pageId, title) {
  return await notion.pages.update({
    page_id: pageId,
    properties: {
      Name: { title: [{ text: { content: title } }] },
    },
  });
}

async function deletePage(pageId) {
  return await notion.pages.update({ page_id: pageId, archived: true });
}

async function searchNotion(query) {
  const response = await notion.search({
    query,
    page_size: 50,
  });
  return response.results;
}

async function getDatabases() {
  const response = await notion.search({
    filter: { value: 'database', property: 'object' },
    page_size: 100,
  });
  return response.results;
}

async function getDatabaseItems(databaseId) {
  const response = await notion.databases.query({ database_id: databaseId });
  return response.results;
}

module.exports = {
  notion,
  getActivePages,
  getPage,
  getPageContent,
  createPage,
  updatePage,
  deletePage,
  searchNotion,
  getDatabases,
  getDatabaseItems,
};

if (require.main === module) {
  (async () => {
    console.log('Testing Notion connection...\n');
    const pages = await getActivePages();
    console.log(`Found ${pages.length} pages\n`);
    pages.forEach((p, i) => console.log(`${i + 1}. ${p.id}`));
  })();
}
