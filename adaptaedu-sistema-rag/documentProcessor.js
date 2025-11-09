// documentProcessor.js
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import Tesseract from 'tesseract.js';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import speech from '@google-cloud/speech';
import vision from '@google-cloud/vision';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');
ffmpeg.setFfprobePath('C:\\ffmpeg\\bin\\ffprobe.exe');

const serviceAccountPath = path.join(__dirname, 'firebase-adaptaedu.json');
const speechClient = new speech.SpeechClient({
  keyFilename: serviceAccountPath
});

export class DocumentProcessor {
  constructor() {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50
    });
    
    this.visionClient = new vision.ImageAnnotatorClient({
      keyFilename: serviceAccountPath
    });
  }

  async processPDF(filePath) {
    const dataBuffer = await fs.readFile(filePath);
    const uint8Array = new Uint8Array(dataBuffer);
    
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDoc = await loadingTask.promise;
    
    const pages = [];
    
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      pages.push({
        text: pageText,
        pageNumber: i
      });
    }
    
    return {
      pages,
      metadata: {
        tipo: 'pdf',
        paginas: pdfDoc.numPages,
        fonte: path.basename(filePath)
      }
    };
  }

  async processImage(filePath) {
    try {
      console.log('Usando Google Vision API...');
      const [result] = await this.visionClient.textDetection(filePath);
      const detections = result.textAnnotations;
      
      if (detections && detections.length > 0) {
        const fullText = detections[0].description;
        console.log(`Texto extraído (Vision): ${fullText.substring(0, 100)}...`);
        
        return {
          pages: [{
            text: fullText,
            confidence: 95
          }],
          metadata: {
            tipo: 'imagem',
            fonte: path.basename(filePath),
            ocr_engine: 'google_vision'
          }
        };
      }
    } catch (error) {
      console.log('⚠️  Google Vision falhou, usando Tesseract...', error.message);
    }

    const { data } = await Tesseract.recognize(
      filePath, 
      'por+eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Tesseract: ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_pageseg_mode: Tesseract.PSM.AUTO
      }
    );
    
    console.log(`Confiança OCR: ${data.confidence.toFixed(2)}%`);
    console.log(`Texto extraído (Tesseract): ${data.text.substring(0, 100)}...`);
    
    const cleanedText = data.text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    return {
      pages: [{
        text: cleanedText,
        confidence: data.confidence
      }],
      metadata: {
        tipo: 'imagem',
        fonte: path.basename(filePath),
        ocr_engine: 'tesseract'
      }
    };
  }

  async processVideo(filePath) {
    try {
      await new Promise((resolve, reject) => {
        ffmpeg.getAvailableFormats((err, formats) => {
          if (err) reject(err);
          else resolve(formats);
        });
      });
    } catch (error) {
      throw new Error('FFmpeg não instalado. Para processar vídeos, instale o FFmpeg: https://ffmpeg.org/download.html');
    }

    const audioPath = filePath.replace(/\.(mp4|avi|mov|mkv)$/i, '.wav');
    const absoluteAudioPath = path.resolve(audioPath);
    
    console.log('Extraindo áudio para:', absoluteAudioPath);
    
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .output(absoluteAudioPath)
        .audioFrequency(16000)
        .audioChannels(1)
        .audioCodec('pcm_s16le')
        .format('wav')
        .on('end', () => {
          console.log('Áudio extraído com sucesso');
          resolve();
        })
        .on('error', reject)
        .run();
    });

    try {
      await fs.access(absoluteAudioPath);
      console.log('Arquivo de áudio confirmado:', absoluteAudioPath);
    } catch (error) {
      throw new Error(`Arquivo de áudio não foi criado: ${absoluteAudioPath}`);
    }

    const stats = await fs.stat(absoluteAudioPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    const audioDurationSeconds = stats.size / (16000 * 2);
    
    console.log(`Áudio: ${fileSizeMB.toFixed(2)} MB (~${Math.floor(audioDurationSeconds)}s)`);

    let segments = [];

    if (audioDurationSeconds <= 60) {
      console.log('Usando método rápido (recognize)...');
      const audioBytes = await fs.readFile(absoluteAudioPath);
      
      const request = {
        audio: {
          content: audioBytes.toString('base64'),
        },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'pt-BR',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
        },
      };

      const [response] = await speechClient.recognize(request);
      
      segments = response.results.map(result => ({
        text: result.alternatives[0].transcript,
        startTime: result.resultEndTime ? 
          parseFloat(result.resultEndTime.seconds || 0) : 0,
        endTime: result.resultEndTime ? 
          parseFloat(result.resultEndTime.seconds || 0) + 
          parseFloat(result.resultEndTime.nanos || 0) / 1e9 : 0
      }));
    } else {
      console.log('Áudio longo detectado. Fazendo upload para Firebase Storage...');
      
      const { FirebaseStorage } = await import('./firebaseStorage.js');
      const firebase = new FirebaseStorage();
      
      const audioFileName = `temp-audio/${Date.now()}-${path.basename(absoluteAudioPath)}`;
      const audioUri = await firebase.uploadFile(absoluteAudioPath, audioFileName);
      
      console.log('Áudio no Firebase:', audioUri);
      
      const gsUri = firebase.getGsUri(audioFileName);
      console.log('URI gs:// para transcrição:', gsUri);
      console.log('Iniciando transcrição longa (pode levar alguns minutos)...');

      const request = {
        audio: {
          uri: gsUri,
        },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'pt-BR',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
        },
      };

      const [operation] = await speechClient.longRunningRecognize(request);
      console.log('Aguardando conclusão da transcrição...');
      
      const [response] = await operation.promise();
      
      segments = response.results.map(result => ({
        text: result.alternatives[0].transcript,
        startTime: result.resultEndTime ? 
          parseFloat(result.resultEndTime.seconds || 0) : 0,
        endTime: result.resultEndTime ? 
          parseFloat(result.resultEndTime.seconds || 0) + 
          parseFloat(result.resultEndTime.nanos || 0) / 1e9 : 0
      }));

      console.log('Limpando arquivo temporário do Firebase...');
      await firebase.deleteFile(audioFileName);
    }

    await fs.unlink(absoluteAudioPath);
    console.log('Transcrição concluída');

    return {
      pages: segments.map(seg => ({
        text: seg.text,
        startTime: seg.startTime,
        endTime: seg.endTime
      })),
      metadata: {
        tipo: 'video',
        fonte: path.basename(filePath)
      }
    };
  }

  async processText(filePath) {
    const text = await fs.readFile(filePath, 'utf-8');
    
    return {
      pages: [{ text }],
      metadata: {
        tipo: 'texto',
        fonte: path.basename(filePath)
      }
    };
  }

  async processJSON(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(content);
    
    const text = JSON.stringify(jsonData, null, 2);
    
    return {
      pages: [{ text }],
      metadata: {
        tipo: 'json',
        fonte: path.basename(filePath)
      }
    };
  }

  async chunkText(pages, metadata) {
    const allChunks = [];
    
    for (const page of pages) {
      const chunks = await this.splitter.createDocuments([page.text]);
      
      chunks.forEach((chunk, index) => {
        const chunkData = {
          text: chunk.pageContent,
          metadata: {
            ...metadata,
            chunk_index: allChunks.length,
            total_chunks: null
          }
        };

        if (metadata.tipo === 'pdf' && page.pageNumber) {
          chunkData.metadata.localizacao = { pagina: page.pageNumber };
        } else if (metadata.tipo === 'video' && page.startTime !== undefined) {
          chunkData.metadata.localizacao = {
            timestamp_inicio: page.startTime,
            timestamp_fim: page.endTime
          };
        } else if (metadata.tipo === 'imagem') {
          if (page.confidence) {
            chunkData.metadata.ocr_confidence = page.confidence;
          }
        }

        allChunks.push(chunkData);
      });
    }

    allChunks.forEach(chunk => {
      chunk.metadata.total_chunks = allChunks.length;
    });

    return allChunks;
  }

  async processDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    let docData;
    switch (ext) {
      case '.pdf':
        docData = await this.processPDF(filePath);
        break;
      case '.png':
      case '.jpg':
      case '.jpeg':
        docData = await this.processImage(filePath);
        break;
      case '.mp4':
      case '.avi':
      case '.mov':
      case '.mkv':
        docData = await this.processVideo(filePath);
        break;
      case '.txt':
      case '.md':
        docData = await this.processText(filePath);
        break;
      case '.json':
        docData = await this.processJSON(filePath);
        break;
      default:
        throw new Error(`Formato não suportado: ${ext}`);
    }

    return await this.chunkText(docData.pages, docData.metadata);
  }

  async getFileStats(filePath) {
    const stats = await fs.stat(filePath);
    return {
      tamanho_bytes: stats.size,
      criado_em: stats.birthtime
    };
  }
}