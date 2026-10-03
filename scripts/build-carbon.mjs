// 탄소리포트 전용 빌드 — 미니게임을 뺀 사이트를 dist/ 에 만든다.
//
// Cloudflare Pages (탄소리포트 전용 프로젝트) 설정:
//   Build command           node scripts/build-carbon.mjs
//   Build output directory  dist
//
// 로컬 확인:  node scripts/build-carbon.mjs && npx serve dist
//
// 동작
//   1. 아래 INCLUDE 목록만 dist/ 로 복사 (허용 목록 방식 — 새로 추가한 게임 파일이
//      실수로 딸려 나가지 않게). 탄소리포트 쪽에 새 파일·폴더가 생기면 여기에 추가할 것.
//   2. HTML 안의 <!-- minigame:start --> ~ <!-- minigame:end --> 구간을 잘라낸다.
//      → 홈 서비스 그리드는 원래 앱처럼 11칸이 된다.
//   3. 결과물에 game.html 참조나 게임 에셋이 남아 있으면 빌드를 실패시킨다.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');

const INCLUDE = [
  'index.html', 'allmenu.html', 'mypage.html', 'carbon.html',
  'app.css', 'fit.js', 'transition.js', 'theme.js', '_headers',
  'fonts', 'img',
];

// img/ 안에서 게임만 쓰는 에셋
const GAME_ASSETS = [
  'img/ic_game.png', 'img/ic_railrun.png', 'img/game_home.png', 'img/bg_night.png',
  'img/rail-left.png', 'img/rail-right.png', 'img/train-left.png', 'img/train-right.png',
];
// 레일런 등급 뱃지·토끼 마스코트 (img/badge_*.png, img/rabbit_*.png) — 접두어로 한 번에 제외
const GAME_ASSET_PREFIXES = ['badge_', 'rabbit_'];

const MARKER = /[ \t]*<!-- minigame:start[\s\S]*?<!-- minigame:end -->[ \t]*\r?\n?/g;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

for (const name of INCLUDE) {
  const src = join(ROOT, name);
  if (!existsSync(src)) throw new Error(`INCLUDE 항목이 없음: ${name}`);
  cpSync(src, join(OUT, name), { recursive: true });
}
for (const f of GAME_ASSETS) rmSync(join(OUT, f), { force: true });
for (const f of readdirSync(join(OUT, 'img'))) {
  if (GAME_ASSET_PREFIXES.some(p => f.startsWith(p))) rmSync(join(OUT, 'img', f));
}

const htmlFiles = readdirSync(OUT).filter(f => f.endsWith('.html'));
for (const f of htmlFiles) {
  const p = join(OUT, f);
  const src = readFileSync(p, 'utf8');
  const starts = (src.match(/<!-- minigame:start/g) || []).length;
  const ends = (src.match(/<!-- minigame:end -->/g) || []).length;
  if (starts !== ends) throw new Error(`${f}: minigame:start ${starts}개 / end ${ends}개 — 짝이 안 맞음`);
  const out = src.replace(MARKER, '');
  if (out !== src) console.log(`  ${f}: 미니게임 구간 ${starts}개 제거`);
  writeFileSync(p, out);
}

// 검증 — 게임으로 가는 길이 남아 있으면 배포하지 않는다
const leaks = [];
for (const f of htmlFiles) {
  const s = readFileSync(join(OUT, f), 'utf8');
  for (const needle of ['game.html', 'miniGameCell', 'folderOverlay', ...GAME_ASSETS]) {
    if (s.includes(needle)) leaks.push(`${f} → ${needle}`);
  }
}
if (leaks.length) throw new Error('미니게임 흔적이 남아 있음:\n  ' + leaks.join('\n  '));

console.log(`완료: ${relative(ROOT, OUT)}/ (${htmlFiles.length}개 페이지)`);
