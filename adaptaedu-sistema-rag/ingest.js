// ingest.js
import { GrokClient } from './grokClient.js';
import { MongoDBService } from './mongoService.js';
import { DocumentProcessor } from './documentProcessor.js';
import 'dotenv/config';

const grok = new GrokClient();
const mongo = new MongoDBService();
const processor = new DocumentProcessor();

async function ingestDocument(filePath, tags = []) {
  console.log(`Processando: ${filePath}`);
  
  const chunks = await processor.processDocument(filePath);
  console.log(`Chunks criados: ${chunks.length}`);

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Gerando título e embedding ${i + 1}/${chunks.length}`);
    
    const titulo = await grok.generateChunkTitle(chunks[i].text, chunks[i].metadata.tipo);
    const embedding = await grok.createEmbedding(chunks[i].text);
    
    await mongo.insertChunk({
      text: chunks[i].text,
      embedding,
      metadata: {
        ...chunks[i].metadata,
        titulo,
        tags
      }
    });
  }

  console.log(`✓ ${filePath} indexado com sucesso\n`);
}

async function main() {
  const filePath = process.argv[2];
  const tags = process.argv[3] ? process.argv[3].split(',') : [];

  if (!filePath) {
    console.error('Uso: node src/ingest.js <arquivo> [tags]');
    process.exit(1);
  }

  await mongo.connect();
  await ingestDocument(filePath, tags);
  await mongo.close();
  
  console.log('Ingestão concluída!');
}

main().catch(console.error);