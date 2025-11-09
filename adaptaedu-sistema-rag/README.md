# Sistema RAG AdaptaEdu - Upload

Sistema de processamento e busca semântica de documentos que **roda localmente** mas armazena dados na **nuvem** (Firebase Storage + MongoDB Atlas).

## 🏗️ Arquitetura

### Estratégia de Armazenamento

**Local (Processamento):**
- Processamento de documentos acontece na máquina local
- Arquivos temporários são mantidos em `/temp` durante ingestão
- FFmpeg instalado localmente para extração de áudio de vídeos

**Nuvem (Persistência):**
- **Firebase Storage**: Armazena arquivos originais (`gs://bucket/documentos/`)
- **MongoDB Atlas**: Armazena chunks de texto, embeddings vetoriais e metadados completos

### Metadados Salvos

Cada chunk no MongoDB contém:
- `conteudo`: Texto extraído
- `embedding`: Vetor de 768 ou 1536 dimensões
- `metadados`:
  - `titulo`: Gerado por IA
  - `fonte`: Nome do arquivo original
  - `tipo`: pdf | imagem | video | texto | json
  - `localizacao`: página (PDF) ou timestamp (vídeo)
  - `tags`: Manuais + auto-geradas por IA
  - `arquivo_url`: URL pública no Firebase
  - `ocr_confidence`: Precisão OCR (imagens)
  - `chunk_index` e `total_chunks`

## 🛠️ Tecnologias

**Backend:**
- Node.js + Express
- MongoDB (busca vetorial com índice HNSW)
- Firebase Admin SDK (Storage)

**Processamento:**
- **PDF**: pdfjs-dist
- **Imagens**: Google Vision API + Tesseract.js (fallback)
- **Vídeos**: FFmpeg + Google Speech-to-Text
- **Text Splitting**: LangChain RecursiveCharacterTextSplitter

**IA/ML:**
- Google Generative AI (embeddings: `text-embedding-004`, chat: `gemini-2.0-flash-exp`)
- Grok (fallback para quota exceeded)

## 📦 Instalação

```bash
# 1. Clone e instale dependências
npm install

# 2. Instale FFmpeg (necessário para vídeos)
# Windows: Baixe de https://ffmpeg.org/download.html
# Linux: sudo apt install ffmpeg
# macOS: brew install ffmpeg

# 3. Configure variáveis de ambiente (.env)
GOOGLE_API_KEY=sua_chave_google
GROK_API_KEY=sua_chave_grok
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com

# 4. Adicione firebase-adaptaedu.json (service account) na raiz

# 5. Inicie o servidor (porta 3000)
npm start
```

Acesse o sistema via **interface HTML** (index.html) que consome os endpoints:
- `POST /upload` - Upload de documentos
- `GET /documentos` - Listar documentos
- `DELETE /documento/:url` - Remover documento

## 📋 Formatos Suportados

PDF, PNG, JPG, MP4, AVI, MOV, MKV, TXT, MD, JSON