import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '../dist');
const destTemplatesDir = path.resolve(__dirname, '../../backend/templates');
const destStaticDir = path.resolve(__dirname, '../../backend/static');

console.log('Copying build files to backend...');

// Copy index.html
const srcIndex = path.join(srcDir, 'index.html');
const destIndex = path.join(destTemplatesDir, 'index.html');
fs.copyFileSync(srcIndex, destIndex);
console.log('Synced template: index.html');

// Clean and copy static assets
const assetsDir = path.join(destStaticDir, 'assets');
if (fs.existsSync(assetsDir)) {
  fs.rmSync(assetsDir, { recursive: true, force: true });
}
fs.mkdirSync(assetsDir, { recursive: true });

// Copy all built static assets
const items = fs.readdirSync(srcDir);
for (const item of items) {
  if (item === 'index.html') continue;
  const srcPath = path.join(srcDir, item);
  const destPath = path.join(destStaticDir, item);
  fs.cpSync(srcPath, destPath, { recursive: true });
  console.log(`Synced static file/dir: ${item}`);
}

console.log('Build output successfully synchronized to Django backend!');
