// grokClient.js
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export class GrokClient {
  constructor(apiKey = process.env.GOOGLE_API_KEY, grokKey = process.env.GROK_API_KEY) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.embeddingModel = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    this.chatModel = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    this.grok = new OpenAI({
      apiKey: grokKey,
      baseURL: 'https://api.x.ai/v1'
    });
  }

  async createEmbedding(text) {
    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      if (this.isQuotaError(error)) {
        console.log('⚠️  Google quota excedida, usando embedding genérico...');
        return this.createFallbackEmbedding(text);
      }
      throw error;
    }
  }

  createFallbackEmbedding(text) {
    const hash = this.simpleHash(text);
    const embedding = new Array(768).fill(0);
    for (let i = 0; i < 768; i++) {
      embedding[i] = Math.sin(hash * (i + 1)) * 0.5;
    }
    return embedding;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }

  async chat(messages, temperature = 0.3) {
    try {
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role === 'user');
      
      let prompt = '';
      if (systemMessage) {
        prompt += systemMessage.content + '\n\n';
      }
      prompt += userMessages.map(m => m.content).join('\n\n');

      const result = await this.chatModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: 2048,
        }
      });

      return result.response.text();
    } catch (error) {
      if (this.isQuotaError(error)) {
        console.log('⚠️  Google quota excedida, usando Grok...');
        return await this.chatWithGrok(messages, temperature);
      }
      throw error;
    }
  }

  async chatWithGrok(messages, temperature = 0.3) {
    const grokMessages = messages.map(m => ({
      role: m.role === 'system' ? 'system' : 'user',
      content: m.content
    }));

    const completion = await this.grok.chat.completions.create({
      model: 'grok-4-fast-reasoning',
      messages: grokMessages,
      temperature: temperature,
      max_tokens: 2048
    });

    return completion.choices[0].message.content;
  }

  isQuotaError(error) {
    const errorMsg = error.message?.toLowerCase() || '';
    return errorMsg.includes('quota') || 
           errorMsg.includes('limit') || 
           errorMsg.includes('rate limit') ||
           error.status === 429;
  }

  async generateTags(text, documentType = 'documento') {
    const sample = text.substring(0, 1500);
    
    const typePrompts = {
      'imagem': 'Este é um texto extraído de uma IMAGEM usando OCR. Gere 5-7 tags relevantes que descrevam: tipo de conteúdo visual, tema, assunto principal, palavras-chave importantes. Exemplos: diagrama, gráfico, texto manuscrito, formulário, captura de tela, etc.',
      'pdf': 'Este é um texto extraído de um PDF. Gere 5-7 tags relevantes sobre: tema, área do conhecimento, tipo de documento (artigo, relatório, manual, etc), assuntos principais.',
      'video': 'Esta é uma transcrição de um VÍDEO. Gere 5-7 tags relevantes sobre: tema, assunto, tipo de conteúdo (aula, tutorial, palestra, etc), tópicos abordados.',
      'texto': 'Este é um documento de texto. Gere 5-7 tags relevantes sobre: tema, assunto, área do conhecimento, tópicos principais.'
    };

    const specificPrompt = typePrompts[documentType] || typePrompts['texto'];
    
    const response = await this.chat([
      {
        role: 'system',
        content: `${specificPrompt}\n\nRetorne APENAS as tags separadas por vírgula, em português, minúsculas, sem explicações. Exemplo: matemática, geometria, trigonometria, educação, ensino médio`
      },
      {
        role: 'user',
        content: `Conteúdo:\n${sample}`
      }
    ], 0.7);

    return response
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length < 30)
      .slice(0, 7);
  }

  async generateChunkTitle(text, documentType = 'documento') {
    const sample = text.substring(0, 800);
    
    const response = await this.chat([
      {
        role: 'system',
        content: `Você é um assistente que cria títulos descritivos e concisos para fragmentos de documentos.
        
Gere um título de 3-8 palavras que resuma o conteúdo principal deste fragmento.
O título deve ser:
- Descritivo e específico
- Em português
- Sem pontuação no final
- Capitalizado (primeira letra maiúscula)

Retorne APENAS o título, sem aspas ou explicações.`
      },
      {
        role: 'user',
        content: `Tipo de documento: ${documentType}\n\nConteúdo do fragmento:\n${sample}`
      }
    ], 0.5);

    return response.trim().replace(/^["']|["']$/g, '');
  }
}