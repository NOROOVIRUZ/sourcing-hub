import { parse } from 'kordoc';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'catalog-config.json');
const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'index.json');

interface Config {
  catalog_dir: string;
}

interface CatalogEntry {
  id: string;
  filename: string;
  supplier: string;
  text: string;
  pages: number;
  mtime: string;
  parsed_at: string;
}

function extractSupplier(filename: string): string {
  return filename.replace(/\.pdf$/i, '').split(/[_\s\-]/)[0];
}

async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('catalog-config.json 없음. catalog-config.example.json 복사해서 경로 설정해줘.');
    process.exit(1);
  }

  const config: Config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const catalogDir = config.catalog_dir;

  if (!fs.existsSync(catalogDir)) {
    console.error(`폴더 접근 불가: ${catalogDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(catalogDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`PDF ${files.length}개 발견`);

  // 기존 인덱스 로드 (변경 없는 파일 스킵용)
  const existing: Record<string, CatalogEntry> = {};
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const old = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      for (const c of old.catalogs || []) {
        existing[c.filename] = c;
      }
    } catch {}
  }

  const catalogs: CatalogEntry[] = [];
  let parsed = 0;
  let skipped = 0;

  for (const filename of files) {
    const filepath = path.join(catalogDir, filename);
    const mtime = fs.statSync(filepath).mtimeMs.toString();

    if (existing[filename] && existing[filename].mtime === mtime) {
      catalogs.push(existing[filename]);
      skipped++;
      continue;
    }

    console.log(`파싱중 (${parsed + 1}/${files.length - skipped}): ${filename}`);
    try {
      const buffer = fs.readFileSync(filepath);
      const result = await parse(buffer);

      if (result.success) {
        catalogs.push({
          id: filename.replace(/\.pdf$/i, '').toLowerCase().replace(/[\s]+/g, '-'),
          filename,
          supplier: extractSupplier(filename),
          text: result.markdown || '',
          pages: result.metadata?.pageCount || 0,
          mtime,
          parsed_at: new Date().toISOString(),
        });
        parsed++;
      } else {
        console.error(`파싱 실패: ${filename} — ${(result as any).error}`);
      }
    } catch (e: any) {
      console.error(`에러: ${filename} — ${e.message}`);
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
    built_at: new Date().toISOString(),
    total: catalogs.length,
    catalogs,
  }, null, 2));

  console.log(`\n✅ 완료 — 신규 파싱 ${parsed}개, 스킵 ${skipped}개`);
  console.log(`index.json 저장됨: ${OUTPUT_PATH}`);
}

main().catch(console.error);
