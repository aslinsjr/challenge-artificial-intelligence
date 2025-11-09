// server.js
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { GrokClient } from './grokClient.js';
import { MongoDBService } from './mongoService.js';
import { DocumentProcessor } from './documentProcessor.js';
import { FirebaseStorage } from './firebaseStorage.js';

const app = express();
const upload = multer({
  storage: multer.diskStorage({
    destination: 'temp/',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  })
});

app.use(cors());
app.use(express.json());

const grok = new GrokClient();
const mongo = new MongoDBService();
const processor = new DocumentProcessor();
const firebase = new FirebaseStorage();

await mongo.connect();

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const localPath = req.file.path;
    const fileName = req.file.originalname;
    const manualTags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [];

    console.log('1. Processando arquivo local...');
    const chunks = await processor.processDocument(localPath);
    const fileStats = await processor.getFileStats(localPath);

    console.log('2. Gerando tags automáticas...');
    const autoTags = await grok.generateTags(chunks[0].text, chunks[0].metadata.tipo);
    const allTags = [...new Set([...manualTags, ...autoTags])];
    console.log(`Tags: ${allTags.join(', ')}`);

    console.log('3. Fazendo upload para Firebase...');
    const firebaseUrl = await firebase.uploadFile(
      localPath, 
      `documentos/${Date.now()}-${fileName}`
    );

    console.log('4. Gerando títulos, embeddings e salvando no MongoDB...');
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      console.log(`  Chunk ${i + 1}/${chunks.length}...`);
      const titulo = await grok.generateChunkTitle(chunk.text, chunk.metadata.tipo);
      const embedding = await grok.createEmbedding(chunk.text);
      
      await mongo.insertChunk({
        text: chunk.text,
        embedding,
        metadata: {
          ...chunk.metadata,
          titulo,
          arquivo_url: firebaseUrl,
          arquivo_nome: fileName,
          tamanho_bytes: fileStats.tamanho_bytes,
          tags: allTags
        }
      });
    }

    console.log('5. Limpando arquivo temporário...');
    await fs.unlink(localPath);

    res.json({ 
      success: true, 
      chunks: chunks.length,
      arquivo_url: firebaseUrl,
      tamanho_mb: (fileStats.tamanho_bytes / 1024 / 1024).toFixed(2),
      tags: allTags
    });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/query', async (req, res) => {
  try {
    const { pergunta, filtros = {}, topK = 5 } = req.body;

    const queryEmbedding = await grok.createEmbedding(pergunta);
    const resultados = await mongo.vectorSearch(queryEmbedding, topK, filtros);

    if (resultados.length === 0) {
      return res.json({
        resposta: 'Não encontrei informações relevantes nos documentos.',
        arquivos: [],
        fontes: []
      });
    }

    const contexto = resultados
      .map(r => {
        let ref = `${r.metadados.fonte}`;
        if (r.metadados.localizacao) {
          const loc = r.metadados.localizacao;
          if (loc.pagina) ref += ` - página ${loc.pagina}`;
          if (loc.timestamp_inicio !== undefined) {
            const min = Math.floor(loc.timestamp_inicio / 60);
            const sec = Math.floor(loc.timestamp_inicio % 60);
            ref += ` - ${min}:${sec.toString().padStart(2, '0')}`;
          }
        }
        return `[${r.metadados.titulo}]\n${r.conteudo}\nFonte: ${ref}`;
      })
      .join('\n\n---\n\n');

    const resposta = await grok.chat([
      {
        role: 'system',
        content: 'Você responde baseado nos documentos fornecidos. Sempre cite as fontes com suas referências (título, página/timestamp).'
      },
      {
        role: 'user',
        content: `Contexto:\n${contexto}\n\nPergunta: ${pergunta}`
      }
    ]);

    const arquivosUnicos = [...new Map(
      resultados.map(r => [r.metadados.arquivo_url, {
        nome: r.metadados.arquivo_nome,
        tipo: r.metadados.tipo,
        url: r.metadados.arquivo_url
      }])
    ).values()];

    res.json({
      resposta,
      arquivos: arquivosUnicos,
      fontes: resultados.map(r => {
        let ref = r.metadados.fonte;
        if (r.metadados.localizacao) {
          const loc = r.metadados.localizacao;
          if (loc.pagina) ref += ` (pág. ${loc.pagina})`;
          if (loc.timestamp_inicio !== undefined) {
            const min = Math.floor(loc.timestamp_inicio / 60);
            const sec = Math.floor(loc.timestamp_inicio % 60);
            ref += ` (${min}:${sec.toString().padStart(2, '0')})`;
          }
        }
        return {
          titulo: r.metadados.titulo,
          texto: r.conteudo.substring(0, 150) + '...',
          fonte: ref,
          score: r.score.toFixed(3)
        };
      })
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/documentos', async (req, res) => {
  try {
    const docs = await mongo.collection
      .aggregate([
        {
          $group: {
            _id: '$metadados.arquivo_url',
            nome: { $first: '$metadados.arquivo_nome' },
            tipo: { $first: '$metadados.tipo' },
            chunks: { $sum: 1 },
            tamanho: { $first: '$metadados.tamanho_bytes' },
            tags: { $first: '$metadados.tags' }
          }
        },
        {
          $project: {
            url: '$_id',
            nome: 1,
            tipo: 1,
            chunks: 1,
            tamanho_mb: { $divide: ['$tamanho', 1048576] },
            tags: 1,
            _id: 0
          }
        }
      ])
      .toArray();

    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/documento/:url', async (req, res) => {
  try {
    const url = decodeURIComponent(req.params.url);
    
    await mongo.collection.deleteMany({ 'metadados.arquivo_url': url });
    
    const remotePath = url.split('/').pop();
    await firebase.deleteFile(`documentos/${remotePath}`);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});