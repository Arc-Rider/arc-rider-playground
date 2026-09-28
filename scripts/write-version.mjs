import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] ?? 'dist');
let commit = process.env.GIT_COMMIT?.trim();
if (!commit) {
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    commit = 'unknown';
  }
}
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, 'version.json'),
  `${JSON.stringify({ commit, builtAt: new Date().toISOString() }, null, 2)}\n`,
);
console.log(`Wrote ${path.join(outDir, 'version.json')} (${commit.slice(0, 12)})`);
