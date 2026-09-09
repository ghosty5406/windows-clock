# Horloge — économiseur d'écran Windows multi-écrans

Un vrai économiseur d'écran Windows (`.scr`), comme Fliqlo : c'est **Windows**
qui le déclenche après 3 minutes d'inactivité et **Windows** qui verrouille la
session à la reprise. L'horloge couvre tous les écrans et rend la main au
premier mouvement de souris ou frappe clavier. `Ctrl+Alt+V` la déclenche sans
attendre.

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

## Déclencher au clavier — `Ctrl+Alt+V`

L'installeur pose aussi un raccourci dans le menu Démarrer, **Horloge — veille
immédiate**, avec une touche de raccourci : l'horloge s'affiche tout de suite,
sans attendre les 3 minutes.

La touche ne lance pas le `.scr` : elle diffuse `WM_SYSCOMMAND / SC_SCREENSAVE`,
c'est-à-dire qu'elle demande à **Windows** de lancer l'économiseur configuré,
exactement comme il le ferait au bout du délai d'inactivité. C'est la seule
façon d'obtenir le verrouillage — winlogon ne verrouille à la reprise que s'il
a lui-même lancé l'économiseur.

```powershell
powershell -ExecutionPolicy Bypass -File dist\screensaver\Installer.ps1 -Hotkey 'CTRL+ALT+H'
powershell -ExecutionPolicy Bypass -File dist\screensaver\Installer.ps1 -Hotkey ''    # aucune
```

Trois choses à savoir :

- **Délai de grâce.** Revenir dans les ~5 s qui suivent le déclenchement ne
  verrouille pas ; c'est `ScreenSaverGracePeriod`, un réglage de Windows, pas
  de l'horloge.
- **Combinaison déjà prise.** Explorer enregistre la touche sans rien dire si
  elle échoue : si rien ne se passe, une autre application détient la
  combinaison, changez-en. Restez sur `Ctrl+Alt+<lettre>` — c'est ce
  qu'Explorer accepte de façon fiable, et évitez une lettre qu'AltGr utilise
  pour taper : sur un clavier AZERTY, AltGr **est** Ctrl+Alt, donc `AltGr+E`
  déclencherait le verrouillage en pleine frappe. `V` est libre.
- **Emplacement.** Le raccourci doit rester dans le menu Démarrer (ou sur le
  Bureau) : ailleurs, Windows ignore le champ « Touche de raccourci ».

Pointer le raccourci directement sur le `.scr` ne marcherait pas de toute
façon : le raccourci passe par l'association de l'extension, et `.scr` est
souvent détournée par un autre logiciel (AutoCAD, par exemple). `winlogon`,
lui, lance le fichier sans passer par le shell.

Le raccourci pointe vers `Veille.exe`, ~3 Ko compilés à l'installation par
`Add-Type` : pas de fenêtre qui clignote, pas la seconde de démarrage de
PowerShell. Si la compilation échoue (PowerShell 7, qui ne produit pas
d'exécutable autonome), l'installeur retombe sur `Veille.ps1`, qui fait la même
chose en plus lent.

La désinstallation retire aussi la copie dans `%LOCALAPPDATA%`.

> La boîte de dialogue classique « Écran de veille » ne liste que les `.scr`
> présents dans `System32`. L'ouvrir puis cliquer sur OK peut réinitialiser
> `SCRNSAVE.EXE`. Si l'horloge cesse d'apparaître, relancez `npm run install-scr`.

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
