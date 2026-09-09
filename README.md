# Horloge — économiseur d'écran Windows multi-écrans

Un vrai économiseur d'écran Windows (`.scr`), comme Fliqlo : c'est **Windows**
qui le déclenche après 3 minutes d'inactivité et **Windows** qui verrouille la
session à la reprise. L'horloge couvre tous les écrans et rend la main au
premier mouvement de souris ou frappe clavier.

## Installation

```powershell
npm install
npm run install-scr
```

Ça construit `dist\screensaver\`, le copie dans `%LOCALAPPDATA%\HorlogeClaude`
et écrit quatre valeurs sous `HKCU\Control Panel\Desktop` — aucun droit
administrateur nécessaire :

| Valeur | Rôle |
| --- | --- |
| `SCRNSAVE.EXE` | chemin du `.scr` |
| `ScreenSaveActive` | économiseur activé |
| `ScreenSaveTimeOut` | délai d'inactivité, en secondes |
| `ScreenSaverIsSecure` | **verrouille la session à la reprise** |

Un autre délai, ou désinstaller :

```powershell
powershell -ExecutionPolicy Bypass -File dist\screensaver\Installer.ps1 -TimeoutMinutes 10
powershell -ExecutionPolicy Bypass -File dist\screensaver\Installer.ps1 -Uninstall
```

## Exporter vers un autre PC

```powershell
npm run package
```

Produit `dist\HorlogeClaude-<version>.zip` (~108 Mo, Electron inclus — rien à
installer sur la machine cible, ni Node ni npm).

Sur l'autre PC : décompresser n'importe où, double-cliquer **`Installer.cmd`**,
c'est fini. Les fichiers sont copiés dans `%LOCALAPPDATA%\HorlogeClaude`, donc
le dossier décompressé peut être supprimé ensuite. `Desinstaller.cmd` fait
l'inverse.

## Réglages — `config.json`

| Clé | Défaut | Rôle |
| --- | --- | --- |
| `showSeconds` | `true` | Secondes en exposant |
| `hour12` | `false` | Format 12 h avec am/pm |
| `locale` | `"fr-FR"` | Langue de la date |
| `accent` | `"#7dd3fc"` | Couleur d'accent (secondes, filet, halo) |
| `heroOnPrimaryOnly` | `true` | Grande horloge sur l'écran principal, version sobre sur les autres. `false` = même taille partout |

Le `.scr` embarque sa propre copie de `config.json`. Deux façons de le
modifier :

- **Paramètres → Écran de veille → Paramètres** ouvre directement la copie
  utilisée par l'économiseur (Windows lance le `.scr` avec `/c`) ;
- ou éditez `config.json` à la racine du projet puis relancez `npm run build`.

## Les trois modes

Windows passe un argument au `.scr` selon ce qu'il attend :

| Argument | Comportement |
| --- | --- |
| `/s` | Affiche l'horloge sur tous les écrans |
| `/p <hwnd>` | Miniature d'aperçu — on sort immédiatement, sans rien dessiner |
| `/c[:<hwnd>]` | Ouvre `config.json` dans l'éditeur par défaut |

Un double-clic sur le `.scr` depuis l'Explorateur ouvre les paramètres d'écran
de veille : c'est le comportement standard de Windows pour cette extension, pas
un bug.

## Développement

```powershell
npm start                       # lance l'horloge en plein écran (mode /s)
npm run build                   # reconstruit le .scr
npx electron tools/preview.js   # rend les deux variantes en PNG dans ./preview
```

`npm start` ne verrouille pas : le verrouillage vient de Windows, et Windows ne
verrouille que quand c'est lui qui a lancé l'économiseur.

Journal : `%APPDATA%\windows-clock\clock.log` — un économiseur d'écran n'a pas
de console, c'est le seul moyen de voir ce qui s'est passé pendant un
déclenchement.

## Design

Fond noir bleuté avec trois halos qui dérivent lentement, grain fin contre le
banding, vignette. Chiffres en Segoe UI Variable Display, graisse 200, chasse
fixe — chaque chiffre se fond individuellement quand il change. Un filet se
remplit sur la minute en cours. Le bloc dérive de quelques pixels sur 15
minutes : protection contre le marquage d'écran, invisible à l'œil.
