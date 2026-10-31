// scripts/clean.mjs — Remove build output so stale compiled files never get packaged
import fs from 'node:fs';

for (const dir of ['dist', 'dist-main', 'dist-preload', 'dist-electron']) {
    fs.rmSync(dir, { recursive: true, force: true });
}
