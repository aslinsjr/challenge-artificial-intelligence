// firebaseStorage.js
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FirebaseStorage {
  constructor() {
    if (!admin.apps.length) {
      const serviceAccountPath = path.join(__dirname, 'firebase-adaptaedu.json');
      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, 'utf-8')
      );
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
    }

    this.bucket = admin.storage().bucket();
  }

  async uploadFile(localPath, remotePath) {
    await this.bucket.upload(localPath, {
      destination: remotePath,
      metadata: {
        contentType: this.getContentType(localPath)
      }
    });

    const file = this.bucket.file(remotePath);
    await file.makePublic();

    return `https://storage.googleapis.com/${this.bucket.name}/${remotePath}`;
  }

  getGsUri(remotePath) {
    return `gs://${this.bucket.name}/${remotePath}`;
  }

  async deleteFile(remotePath) {
    await this.bucket.file(remotePath).delete();
  }

  getContentType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
      'pdf': 'application/pdf',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'mkv': 'video/x-matroska',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg'
    };
    return types[ext] || 'application/octet-stream';
  }
}