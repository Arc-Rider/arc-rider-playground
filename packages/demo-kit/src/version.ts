import { readFileSync } from 'node:fs';
import path from 'node:path';

export type DemoVersion = { commit: string; builtAt?: string };

export function readVersion(dir = process.cwd()): DemoVersion {
  const fromEnv = process.env.GIT_COMMIT?.trim();
  if (fromEnv) return { commit: fromEnv };
  for (const candidate of [path.join(dir, 'version.json'), path.join(dir, 'dist', 'version.json')]) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf8')) as DemoVersion;
    } catch {
      // try next
    }
  }
  return { commit: 'unknown' };
}
