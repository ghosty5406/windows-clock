// Assemble un vrai economiseur d'ecran Windows (.scr).
//
// Un .scr n'est rien d'autre qu'un .exe avec une autre extension. On copie la
// distribution Electron, on remplace son application par defaut par la notre,
// et on renomme electron.exe. Pas de dependance de packaging supplementaire.
//
//   node tools/build-scr.js

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ELECTRON_DIST = path.join(ROOT, 'node_modules', 'electron', 'dist');
const OUT = path.join(ROOT, 'dist', 'screensaver');
const SCR_NAME = 'HorlogeClaude.scr';

const APP_FILES = ['main.js', 'preload.js', 'config.json', 'package.json'];
const APP_DIRS = ['renderer'];

function main() {
  if (!fs.existsSync(ELECTRON_DIST)) {
    console.error('Distribution Electron introuvable. Lancez d\'abord : npm install');
    process.exit(1);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  console.log('copie de la distribution Electron...');
  fs.cpSync(ELECTRON_DIST, OUT, { recursive: true });

  // Sans ce fichier, Electron cherche resources/app/package.json — le notre.
  fs.rmSync(path.join(OUT, 'resources', 'default_app.asar'), { force: true });

  const appDir = path.join(OUT, 'resources', 'app');
  fs.mkdirSync(appDir, { recursive: true });
  for (const file of APP_FILES) {
    fs.copyFileSync(path.join(ROOT, file), path.join(appDir, file));
  }
  for (const dir of APP_DIRS) {
    fs.cpSync(path.join(ROOT, dir), path.join(appDir, dir), { recursive: true });
  }

  const scr = path.join(OUT, SCR_NAME);
  fs.renameSync(path.join(OUT, 'electron.exe'), scr);

  // Installeur et notice a cote du .scr : le dossier est autonome, il suffit de
  // le compresser pour l'installer sur une autre machine.
  fs.cpSync(path.join(__dirname, 'dist-files'), OUT, { recursive: true });

  console.log('\neconomiseur construit :');
  console.log('  ' + scr);
  console.log('\nInstallation :');
  console.log('  ' + path.join(OUT, 'Installer.cmd'));
}

main();
