const { getEmbedding } = require('./services/embeddingClient');

async function test() {
  try {
    const embedding = await getEmbedding('software engineer');

    console.log('EMBEDDING DIMENSIONS:', embedding.length);
    console.log('FIRST 5 VALUES:', embedding.slice(0, 5));

    process.exit(0);
  } catch (error) {
    console.error('EMBEDDING TEST FAILED:', error);
    process.exit(1);
  }
}

test();