import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const TOOL_ROOT = resolve(SCRIPT_DIR, '..');
const REPO_ROOT = resolve(TOOL_ROOT, '..', '..');
const INDEX = resolve(REPO_ROOT, 'docs', 'index.json');

console.log('📁 레포 루트:', REPO_ROOT);

function git(cmd: string) {
  execSync(`git -C "${REPO_ROOT}" ${cmd}`, { stdio: 'inherit' });
}

// docs/ 폴더 없으면 생성
mkdirSync(resolve(REPO_ROOT, 'docs'), { recursive: true });

// 1. 파싱 실행
console.log('\n📦 카탈로그 파싱 시작...\n');
execSync('npx tsx scripts/parse-catalogs.ts', { stdio: 'inherit', cwd: TOOL_ROOT });

// 2. index.json 생성 확인
if (!existsSync(INDEX)) {
  console.error(`\n❌ index.json 생성 실패: ${INDEX}`);
  process.exit(1);
}

// 3. 변경 여부 확인
try {
  const diff = execSync(`git -C "${REPO_ROOT}" diff --name-only docs/index.json`, { encoding: 'utf8' });
  const untracked = execSync(`git -C "${REPO_ROOT}" ls-files --others --exclude-standard docs/index.json`, { encoding: 'utf8' });
  if (!diff.trim() && !untracked.trim()) {
    console.log('\n✅ 변경사항 없음 — 푸시 생략\n');
    process.exit(0);
  }
} catch {}

// 4. 커밋 + 푸시
const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
console.log('\n🚀 GitHub에 업로드 중...\n');
git(`add docs/index.json`);
git(`commit -m "data: catalog index 갱신 (${now})"`);
git('push');

console.log('\n✅ 완료! 팀원들이 바로 검색할 수 있어.\n');
