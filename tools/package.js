// Construit l'economiseur puis le compresse en une archive prete a copier sur
// une autre machine.
//
//   node tools/package.js

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'dist', 'screensaver');
const { version } = require(path.join(ROOT, 'package.json'));
const ZIP = path.join(ROOT, 'dist', `HorlogeClaude-${version}.zip`);

require('./build-scr.js');

fs.rmSync(ZIP, { force: true });

console.log('\ncompression...');
execFileSync('powershell.exe', [
  '-NoProfile', '-Command',
  `Compress-Archive -Path '${SRC}\\*' -DestinationPath '${ZIP}' -CompressionLevel Optimal`
], { stdio: 'inherit' });

const mb = (fs.statSync(ZIP).size / 1024 / 1024).toFixed(0);
console.log(`\narchive prete : ${ZIP}  (${mb} Mo)`);
console.log('\nSur l\'autre machine : decompresser, puis double-cliquer Installer.cmd');
