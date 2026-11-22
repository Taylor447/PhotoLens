import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

if (!existsSync('android/app/build.gradle') && !existsSync('android/app/build.gradle.kts')) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(command, ['cap', 'add', 'android'], { stdio: 'inherit' });
}
