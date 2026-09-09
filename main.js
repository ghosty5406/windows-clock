// Economiseur d'ecran Windows.
//
// Windows lance le .scr avec un argument qui dit quoi faire :
//   /s          lancer l'economiseur plein ecran
//   /p <hwnd>   miniature d'apercu dans la boite de dialogue
//   /c[:<hwnd>] boite de configuration
//
// C'est Windows qui gere le declenchement (delai d'inactivite) et le
// verrouillage (« A la reprise, afficher l'ecran d'ouverture de session ») :
// il verrouille la session des que ce processus se termine. Notre seule
// responsabilite est de couvrir tous les ecrans, puis de quitter au premier
// signe d'activite.

const { app, BrowserWindow, screen, powerMonitor, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// ---------------------------------------------------------------- config ---

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  const defaults = {
    showSeconds: true,
    hour12: false,
    locale: 'fr-FR',
    accent: '#7dd3fc',
    heroOnPrimaryOnly: true
  };
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch {
    return defaults;
  }
}

const config = loadConfig();

// ------------------------------------------------------------------- log ---

// Un economiseur d'ecran n'a pas de console : le fichier est le seul moyen de
// savoir ce qui s'est passe pendant un declenchement.
let logPath = null;

function log(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    if (!logPath) logPath = path.join(app.getPath('userData'), 'clock.log');
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 256 * 1024) {
      fs.writeFileSync(logPath, '');
    }
    fs.appendFileSync(logPath, line);
  } catch { /* le journal ne doit jamais faire tomber l'economiseur */ }
}

// ------------------------------------------------------------------ mode ---

/** @returns {'show'|'preview'|'configure'} */
function parseMode(argv) {
  for (const raw of argv.slice(1)) {
    const arg = raw.toLowerCase();
    if (!arg.startsWith('/') && !arg.startsWith('-')) continue;
    const flag = arg[1];
    if (flag === 'p') return 'preview';
    if (flag === 'c') return 'configure';
    if (flag === 's') return 'show';
  }
  // Double-clic sur le .scr, ou lancement manuel : on affiche.
  return 'show';
}

const MODE = parseMode(process.argv);

// ----------------------------------------------------------------- etat ---

/** @type {BrowserWindow[]} */
let windows = [];
let quitting = false;
let lastIdle = 0;
let armedAt = 0;

// -------------------------------------------------------------- fenetres ---

function createWindowForDisplay(display, index, total, takeFocus) {
  const { x, y, width, height } = display.bounds;
  const win = new BrowserWindow({
    x, y, width, height,
    frame: false,
    fullscreen: true,
    kiosk: true,
    show: false,
    resizable: false,
    movable: false,
    minimizable: false,
    skipTaskbar: true,
    backgroundColor: '#05070c',
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const isPrimary = display.id === screen.getPrimaryDisplay().id;
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('config', {
      ...config,
      index,
      total,
      variant: (!config.heroOnPrimaryOnly || isPrimary) ? 'hero' : 'minimal'
    });
    // La fenetre sous le curseur prend le focus clavier : sinon la touche
    // tapee pour reprendre la main atterrit dans l'application en dessous.
    if (takeFocus) {
      win.show();
      win.focus();
    } else {
      win.showInactive();
    }
    win.setAlwaysOnTop(true, 'screen-saver');
  });

  return win;
}

function showClocks() {
  const displays = screen.getAllDisplays();
  log(`affichage sur ${displays.length} ecran(s)`);

  const cursor = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  let focusIndex = displays.findIndex((d) => d.id === cursor.id);
  if (focusIndex < 0) focusIndex = 0;

  windows = displays.map((d, i) =>
    createWindowForDisplay(d, i, displays.length, i === focusIndex));
}

/**
 * Fin de l'economiseur. Windows verrouille la session en voyant le processus
 * se terminer, a condition que « A la reprise, afficher l'ecran d'ouverture
 * de session » soit coche (ScreenSaverIsSecure).
 */
function dismiss(reason) {
  if (quitting) return;
  quitting = true;
  log(`activite detectee (${reason}) -> sortie`);
  for (const win of windows) {
    if (!win.isDestroyed()) win.destroy();
  }
  app.exit(0);
}

// ------------------------------------------------------------ boucle idle ---

// Filet de securite : le renderer capte clavier et souris sur ses fenetres,
// mais le compteur systeme rattrape ce qui lui echapperait (entree dirigee
// vers un ecran dont la fenetre n'a pas le focus, manette, etc.).
function watchIdle() {
  lastIdle = powerMonitor.getSystemIdleTime();
  setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime();
    if (Date.now() >= armedAt && idle < lastIdle) dismiss('compteur systeme');
    lastIdle = idle;
  }, 250);
}

// -------------------------------------------------------------------- app ---

if (MODE === 'preview') {
  // Miniature de la boite de dialogue Windows : rien a dessiner, on sort tout
  // de suite plutot que de faire clignoter un plein ecran par-dessus.
  // process.exit et non app.exit : avant que l'app soit prete, app.exit ne
  // termine pas le processus, et Windows relance ce mode a chaque ouverture
  // de la boite de dialogue Ecran de veille.
  process.exit(0);
} else if (MODE === 'configure') {
  // Les reglages tiennent dans config.json : on l'ouvre dans l'editeur par
  // defaut au lieu d'inventer une boite de dialogue.
  app.whenReady().then(async () => {
    await shell.openPath(CONFIG_PATH);
    app.exit(0);
  });
} else if (!app.requestSingleInstanceLock()) {
  app.exit(0);
} else {
  app.whenReady().then(() => {
    log('demarrage en mode economiseur');

    // Windows lance l'economiseur juste apres la derniere action de
    // l'utilisateur ; sans ce delai, un mouvement residuel de la souris le
    // ferait ressortir immediatement.
    armedAt = Date.now() + 1000;

    ipcMain.on('user-activity', () => dismiss('renderer'));
    showClocks();
    watchIdle();

    // Branchement / debranchement d'un ecran : Windows attend que
    // l'economiseur rende la main plutot qu'il ne laisse un ecran decouvert.
    screen.on('display-added', () => dismiss('ecran ajoute'));
    screen.on('display-removed', () => dismiss('ecran retire'));
  });

  app.on('window-all-closed', () => app.exit(0));
}
