const { notion } = require('./index');

const NEWS_TRADE_PAGE_ID = '2daf312e-ab25-80e7-9e8f-c9938d683014';

async function createNewsTradeDatabase() {
  const existing = await notion.search({
    query: 'News Trade Signals',
  });

  const found = existing.results.find(
    r => r.object === 'database' && r.title?.some(t => t.plain_text === 'News Trade Signals')
  );

  if (found) {
    console.log(`Database already exists: ${found.id}`);
    return found;
  }

  const database = await notion.databases.create({
    parent: { type: 'page_id', page_id: NEWS_TRADE_PAGE_ID },
    title: [{ text: { content: 'News Trade Signals' } }],
    properties: {
      'Tên sự kiện': {
        title: {},
      },
      'Mã cổ phiếu': {
        multi_select: {
          options: [],
        },
      },
      'Thời gian (US)': {
        date: {},
      },
      'Bias': {
        select: {
          options: [
            { name: '🟢 Tăng (Bullish)', color: 'green' },
            { name: '🔴 Giảm (Bearish)', color: 'red' },
            { name: '🟡 Trung lập', color: 'yellow' },
          ],
        },
      },
      'Mức độ ảnh hưởng': {
        select: {
          options: [
            { name: '🔥 Cao', color: 'red' },
            { name: '⚡ Trung bình', color: 'yellow' },
            { name: '💧 Thấp', color: 'blue' },
          ],
        },
      },
      'Link liên quan': {
        url: {},
      },
      'Thông tin chi tiết': {
        rich_text: {},
      },
      'Nguồn tin': {
        select: {
          options: [
            { name: 'Reuters', color: 'blue' },
            { name: 'Bloomberg', color: 'purple' },
            { name: 'CNBC', color: 'orange' },
            { name: 'WSJ', color: 'gray' },
            { name: 'Fed', color: 'green' },
            { name: 'Khác', color: 'default' },
          ],
        },
      },
      'Trạng thái': {
        select: {
          options: [
            { name: '📋 Mới', color: 'blue' },
            { name: '👀 Đang theo dõi', color: 'yellow' },
            { name: '✅ Đã giao dịch', color: 'green' },
            { name: '⏭️ Bỏ qua', color: 'gray' },
          ],
        },
      },
    },
  });

  console.log(`Database created: ${database.id}`);
  console.log(`URL: ${database.url}`);
  return database;
}

if (require.main === module) {
  createNewsTradeDatabase()
    .then(db => {
      console.log('\n✅ Database "News Trade Signals" đã được tạo thành công!');
      console.log(`ID: ${db.id}`);
    })
    .catch(err => {
      console.error('❌ Lỗi:', err.message);
      process.exit(1);
    });
}

module.exports = { createNewsTradeDatabase };
