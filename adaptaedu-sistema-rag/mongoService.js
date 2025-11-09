import { MongoClient } from 'mongodb';

export class MongoDBService {
  constructor(uri = process.env.MONGODB_URI) {
    this.client = new MongoClient(uri);
    this.dbName = 'rag_db';
    this.collectionName = 'documentos';
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.collection = this.db.collection(this.collectionName);
    
    // Criar índice vetorial
    await this.createVectorIndex();
  }

  async createVectorIndex() {
    try {
      await this.collection.createIndex({
        embedding: 'vector'
      }, {
        name: 'vector_index',
        vectorOptions: {
          type: 'hnsw',
          similarity: 'cosine',
          dimensions: 1536
        }
      });
    } catch (e) {
      // Índice já existe
    }
  }

  async insertChunk(chunk) {
    const doc = {
      conteudo: chunk.text,
      embedding: chunk.embedding,
      metadados: chunk.metadata,
      criado_em: new Date()
    };
    
    return await this.collection.insertOne(doc);
  }

  async vectorSearch(queryEmbedding, limit = 5, filtros = {}) {
    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit: limit,
          filter: filtros
        }
      },
      {
        $project: {
          conteudo: 1,
          metadados: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ];

    return await this.collection.aggregate(pipeline).toArray();
  }

  async close() {
    await this.client.close();
  }
}
