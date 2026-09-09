// Rendu hors ecran des deux variantes -> PNG. Sert a iterer sur le design
// sans avoir a declencher l'horloge sur les vrais ecrans.
//   npx electron tools/preview.js [dossier-de-sortie]

const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const OUT = process.argv[2] && !process.argv[2].startsWith('-')
  ? process.argv[2]
  : path.join(__dirname, '..', 'preview');

const SHOTS = [
  { name: 'hero', variant: 'hero', width: 2560, height: 1440 },
  { name: 'minimal', variant: 'minimal', width: 2560, height: 1440 }
];

function makeWindow({ width, height }) {
  return new BrowserWindow({
    width, height, show: false, frame: false,
    backgroundColor: '#05070c',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true
    }
  });
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // Toutes les fenetres d'abord : detruire la precedente avant de charger la
  // suivante fait echouer loadFile en ERR_FAILED en mode offscreen.
  const wins = SHOTS.map((shot) => [shot, makeWindow(shot)]);

  await Promise.all(wins.map(([shot, win]) =>
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
      .then(() => win.webContents.send('config', {
        locale: 'fr-FR', hour12: false, showSeconds: true,
        accent: '#7dd3fc', variant: shot.variant, index: 0, total: 3
      }))
  ));

  // Laisse les animations d'entree se terminer.
  await new Promise((r) => setTimeout(r, 2600));

  for (const [shot, win] of wins) {
    const image = await win.webContents.capturePage();
    const file = path.join(OUT, `${shot.name}.png`);
    fs.writeFileSync(file, image.toPNG());
    console.log('ecrit', file);
  }

  app.exit(0);
});
