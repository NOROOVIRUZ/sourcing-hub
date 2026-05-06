import { parse } from 'kordoc';
import * as fs from 'fs';
import * as path from 'path';
import { createCanvas } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const TOOL_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(TOOL_ROOT, '..', '..');
const CONFIG_PATH = path.join(TOOL_ROOT, 'catalog-config.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'docs', 'index.json');

interface Config { catalog_dir: string; }
interface CatalogEntry {
  id: string; filename: string; supplier: string;
  text: string; pages: number; mtime: string; parsed_at: string;
}

function extractSupplier(filename: string): string {
  return filename.replace(/\.pdf$/i, '').split(/[_\s\-]/)[0];
}

async function ocrPdf(buffer: Buffer): Promise<string> {
  const pdfjsLib = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as any;
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const worker = await createWorker('eng');
  let allText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx as any, viewport }).promise;
    const imgBuf = canvas.toBuffer('image/png');
    const { data: { text } } = await worker.recognize(imgBuf);
    allText += text + '\n';
    console.log(`  OCR ${i}/${doc.numPages}페이지`);
  }
  await worker.terminate();
  return allText;
}

async function main() {
  console.log('📁 출력 경로:', OUTPUT_PATH);

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('catalog-config.json 없음');
    process.exit(1);
  }

  const config: Config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!fs.existsSync(config.catalog_dir)) {
    console.error(`폴더 접근 불가: ${config.catalog_dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(config.catalog_dir).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`PDF ${files.length}개 발견`);

  const existing: Record<string, CatalogEntry> = {};
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const old = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      for (const c of old.catalogs || []) existing[c.filename] = c;
    } catch {}
  }

  const catalogs: CatalogEntry[] = [];
  let parsed = 0, skipped = 0;

  for (const filename of files) {
    const filepath = path.join(config.catalog_dir, filename);
    const mtime = fs.statSync(filepath).mtimeMs.toString();
    if (existing[filename]?.mtime === mtime) {
      catalogs.push(existing[filename]);
      skipped++;
      continue;
    }
    console.log(`\n파싱중: ${filename}`);
    try {
      const buffer = fs.readFileSync(filepath);
      const result = await parse(buffer);
      let text = '';
      let pages = 0;
      if (result.success) {
        text = result.markdown || '';
        pages = result.metadata?.pageCount || 0;
        if (!text.trim() || (result as any).isImageBased) {
          console.log('  이미지 기반 — OCR 시작...');
          text = await ocrPdf(buffer);
        }
      }
      catalogs.push({
        id: filename.replace(/\.pdf$/i, '').toLowerCase().replace(/\s+/g, '-'),
        filename, supplier: extractSupplier(filename),
        text, pages, mtime, parsed_at: new Date().toISOString(),
      });
      parsed++;
    } catch (e: any) {
      console.error(`에러: ${filename} — ${e.message}`);
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
    built_at: new Date().toISOString(), total: catalogs.length, catalogs,
  }, null, 2));
  console.log(`\n✅ 완료 — 파싱 ${parsed}개, 스킵 ${skipped}개`);
  console.log(`저장됨: ${OUTPUT_PATH}`);
}

main().catch(console.error);
