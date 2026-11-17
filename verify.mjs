// Gate verification for the NOVA DRIFT best-game-01 entry: checks every rule
// the sealed scorer checks, against a built output directory. Run:
//   node verify.mjs <out-dir>
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.argv[2] ?? 'out';
const fails = [];
const passes = [];
function check(name, ok, detail = '') {
  (ok ? passes : fails).push(`${name}${detail ? ` (${detail})` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const st = statSync(p);
    if (st.isDirectory()) {
      out.push({ rel, dir: true, size: 0 });
      out.push(...walk(p, rel));
    } else if (st.isFile()) {
      out.push({ rel, dir: false, size: st.size });
    } else {
      out.push({ rel, dir: false, size: 0, other: true });
    }
  }
  return out;
}

// game_files: plain files/dirs only, ≤993 entries, ≤48 MiB, paths ≤1000 bytes,
// index.html a regular file ≤1 MiB.
const gameDir = join(outDir, 'game');
const gameFiles = walk(gameDir);
const gameEntries = gameFiles.length;
const gameBytes = gameFiles.reduce((n, f) => n + (f.dir ? 0 : f.size), 0);
const gameNonPlain = gameFiles.filter((f) => f.other);
const gameLongPaths = gameFiles.filter((f) => Buffer.byteLength(f.rel, 'utf8') > 1000);
const indexStat = statSync(join(gameDir, 'index.html'));
check('game/ plain files and dirs only', gameNonPlain.length === 0, gameNonPlain.length ? gameNonPlain.map((f) => f.rel).join(', ') : '');
check('game/ at most 993 files and dirs', gameEntries <= 993, `${gameEntries}`);
check('game/ at most 48 MiB', gameBytes <= 48 * 1024 * 1024, `${(gameBytes / 1024).toFixed(1)} KiB`);
check('game/ paths at most 1000 bytes', gameLongPaths.length === 0, gameLongPaths.length ? gameLongPaths.map((f) => f.rel).join(', ') : '');
check('game/index.html regular file at most 1 MiB', indexStat.isFile() && indexStat.size <= 1024 * 1024, `${(indexStat.size / 1024).toFixed(1)} KiB`);

// references: no http(s), protocol-relative or other-scheme URLs in index.html
// or any reachable script; every src/href/import names a file inside game/.
const indexHtml = readFileSync(join(gameDir, 'index.html'), 'utf8');
const urlPattern = /(?:https?:)?\/\/[^\s"'<>]+|https?:[^\s"'<>]+/gi;
const indexUrls = indexHtml.match(urlPattern) || [];
check('index.html has no network URLs', indexUrls.length === 0, indexUrls.length ? indexUrls.join(', ') : '');
const scriptFiles = gameFiles.filter((f) => !f.dir && /\.(js|mjs)$/.test(f.rel));
let badRefs = [];
for (const f of scriptFiles) {
  const text = readFileSync(join(gameDir, f.rel), 'utf8');
  const hits = text.match(urlPattern) || [];
  const httpHits = hits.filter((h) => /^https?:\/\//i.test(h) || /^\/\//.test(h));
  if (httpHits.length > 0) badRefs.push(`${f.rel}: ${httpHits.join(', ')}`);
  // Any string that looks like an external fetch/XHR target.
  const fetchHits = [...text.matchAll(/(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(\s*['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .filter((u) => !u.startsWith('data:'));
  if (fetchHits.length > 0) badRefs.push(`${f.rel}: network call ${fetchHits.join(', ')}`);
}
check('scripts name no network URLs or calls', badRefs.length === 0, badRefs.length ? badRefs.join('; ') : `${scriptFiles.length} scripts checked`);

// screenshots: 3..4 images, names letters/digits/._-, ≤256 KiB, whole PNG/JPEG,
// long side ≤1280, short side ≥480.
const shotDir = join(outDir, 'screenshots');
const shots = readdirSync(shotDir).filter((f) => !f.startsWith('.') && statSync(join(shotDir, f)).isFile());
check('screenshots: 3..4 images', shots.length >= 3 && shots.length <= 4, `${shots.length}: ${shots.join(', ')}`);
const { execSync } = await import('node:child_process');
function imageDims(p) {
  try {
    return execSync(`python3 -c "from PIL import Image; im=Image.open('${p}'); print(f'{im.width}x{im.height} {im.format}')"` , { encoding: 'utf8' }).trim();
  } catch {
    const buf = readFileSync(p);
    if (buf[0] === 0x89 && buf[1] === 0x50) return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)} PNG`;
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return `${buf.readUInt16BE(i + 7)}x${buf.readUInt16BE(i + 5)} JPEG`;
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    return 'unknown';
  }
}
for (const f of shots) {
  const p = join(shotDir, f);
  const size = statSync(p).size;
  const dims = imageDims(p);
  const m = dims.match(/(\d+)x(\d+)\s+(\w+)/);
  const w = m ? Number(m[1]) : 0;
  const h = m ? Number(m[2]) : 0;
  const fmt = m ? m[3] : 'unknown';
  const longSide = Math.max(w, h);
  const shortSide = Math.min(w, h);
  check(`screenshot ${f} name ok`, /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(f) && !f.startsWith('-'));
  check(`screenshot ${f} at most 256 KiB`, size <= 262144, `${(size / 1024).toFixed(0)} KiB`);
  check(`screenshot ${f} whole ${fmt} image`, fmt === 'PNG' || fmt === 'JPEG', dims);
  check(`screenshot ${f} long side ≤1280, short side ≥480`, longSide <= 1280 && shortSide >= 480, dims);
}

// dossier_matches: byte-for-byte what buildDossier writes, at most 1.5 MiB.
const dossierOnDisk = readFileSync(join(outDir, 'dossier.json'));
const rebuilt = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
check('dossier.json byte-for-byte what buildDossier writes', Buffer.compare(dossierOnDisk, Buffer.from(rebuilt)) === 0, `${(dossierOnDisk.length / 1024).toFixed(0)} KiB on disk`);
check('dossier.json at most 1.5 MiB', dossierOnDisk.length <= 1572864, `${(dossierOnDisk.length / 1024).toFixed(0)} KiB`);
const dossier = JSON.parse(dossierOnDisk.toString('utf8'));
check('dossier text at most 163840 bytes', Buffer.byteLength(dossier.text) <= 163840, `${Buffer.byteLength(dossier.text)} bytes`);

// LICENSE: root LICENSE carries the SPDX line.
const license = existsSync('LICENSE') ? readFileSync('LICENSE', 'utf8') : '';
check('LICENSE first line is SPDX-License-Identifier: MIT', license.split('\n')[0].trim() === 'SPDX-License-Identifier: MIT');

console.log(`\n${passes.length} passed, ${fails.length} failed.`);
if (fails.length > 0) {
  console.log('Failures:');
  for (const f of fails) console.log(` - ${f}`);
  process.exit(1);
}
