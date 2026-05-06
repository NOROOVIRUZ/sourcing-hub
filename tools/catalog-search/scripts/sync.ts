import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd(), '..', '..');
const INDEX = 'tools/catalog-search/docs/index.json';

function git(cmd: string) {
  execSync(`git -C "${ROOT}" ${cmd}`, { stdio: 'inherit' });
}

// 1. 파싱 실행
console.log('\n📦 카탈로그 파싱 시작...\n');
execSync('tsx scripts/parse-catalogs.ts', { stdio: 'inherit' });

// 2. index.json 변경 여부 확인
try {
  const diff = execSync(`git -C "${ROOT}" diff --name-only ${INDEX}`, { encoding: 'utf8' });
  const untracked = execSync(`git -C "${ROOT}" ls-files --others --exclude-standard ${INDEX}`, { encoding: 'utf8' });

  if (!diff.trim() && !untracked.trim()) {
    console.log('\n✅ 변경사항 없음 — 푸시 생략\n');
    process.exit(0);
  }
} catch {}

// 3. 커밋 + 푸시
const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
console.log('\n🚀 GitHub에 업로드 중...\n');
git(`add ${INDEX}`);
git(`commit -m "data: catalog index 갱신 (${now})"`);
git('push');

console.log('\n✅ 완료! 대시보드에 반영됐어.\n');
