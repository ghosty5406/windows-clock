<#
.SYNOPSIS
  Installe l'horloge comme economiseur d'ecran Windows.

.DESCRIPTION
  Copie l'economiseur dans %LOCALAPPDATA%\HorlogeClaude puis ecrit les quatre
  valeurs que winlogon lit pour le declencher : le chemin du .scr, l'activation,
  le delai d'inactivite et l'exigence de reconnexion a la reprise. C'est cette
  derniere (ScreenSaverIsSecure) qui fait verrouiller la session par Windows
  des que l'economiseur se termine.

  Tout est sous HKCU : aucun droit administrateur necessaire.

  La copie dans %LOCALAPPDATA% permet de supprimer le dossier decompresse
  ensuite : le chemin enregistre ne depend plus d'ou vous avez lance ceci.

.EXAMPLE
  .\Installer.ps1
  .\Installer.ps1 -TimeoutMinutes 10
  .\Installer.ps1 -Uninstall
#>
param(
  [int]$TimeoutMinutes = 3,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$appName  = 'HorlogeClaude'
$scrName  = "$appName.scr"
$key      = 'HKCU:\Control Panel\Desktop'
$target   = Join-Path $env:LOCALAPPDATA $appName

# SystemParametersInfo applique les reglages a la session en cours ; sans lui il
# faut se deconnecter pour que Windows les relise.
Add-Type -Namespace Spi -Name Native -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true)]
public static extern bool SystemParametersInfo(uint action, uint param, System.IntPtr pv, uint winIni);
'@
$SPI_SETSCREENSAVETIMEOUT = 0x000F
$SPI_SETSCREENSAVEACTIVE  = 0x0011
$SPI_SETSCREENSAVESECURE  = 0x0077
$SPIF_APPLY               = 0x0003   # UPDATEINIFILE | SENDCHANGE

function Apply-Spi([uint32]$action, [uint32]$value, [string]$label) {
  if (-not [Spi.Native]::SystemParametersInfo($action, $value, [IntPtr]::Zero, $SPIF_APPLY)) {
    Write-Warning "SystemParametersInfo a echoue pour $label ; la valeur registre reste ecrite."
  }
}

# Les fichiers sont verrouilles tant que l'economiseur tourne : Windows a pu le
# declencher pendant l'installation.
function Stop-Screensaver {
  Get-Process -Name $scrName -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 400
}

# ------------------------------------------------------------ desinstallation ---

if ($Uninstall) {
  Stop-Screensaver
  Remove-ItemProperty -Path $key -Name 'SCRNSAVE.EXE' -ErrorAction SilentlyContinue
  Set-ItemProperty -Path $key -Name 'ScreenSaveActive' -Value '0'
  Apply-Spi $SPI_SETSCREENSAVEACTIVE 0 'ScreenSaveActive'

  if (Test-Path $target) {
    Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $target) {
      Write-Warning "Le dossier $target n'a pas pu etre supprime entierement."
    } else {
      Write-Host "Fichiers supprimes : $target"
    }
  }

  Write-Host "Economiseur desinstalle." -ForegroundColor Yellow
  Get-ItemProperty $key | Select-Object 'SCRNSAVE.EXE',ScreenSaveActive,ScreenSaveTimeOut,ScreenSaverIsSecure | Format-List
  return
}

# ---------------------------------------------------------------- installation ---

$source = $PSScriptRoot
if (-not (Test-Path (Join-Path $source $scrName))) {
  throw "$scrName introuvable a cote de ce script."
}

Stop-Screensaver

# Deja lance depuis la destination : rien a copier.
if ((Resolve-Path $source).Path.TrimEnd('\') -ne $target.TrimEnd('\')) {
  Write-Host "Copie vers $target ..."
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
}

$scr = Join-Path $target $scrName
$seconds = $TimeoutMinutes * 60

Set-ItemProperty -Path $key -Name 'SCRNSAVE.EXE'        -Value $scr
Set-ItemProperty -Path $key -Name 'ScreenSaveActive'    -Value '1'
Set-ItemProperty -Path $key -Name 'ScreenSaveTimeOut'   -Value "$seconds"
Set-ItemProperty -Path $key -Name 'ScreenSaverIsSecure' -Value '1'

Apply-Spi $SPI_SETSCREENSAVETIMEOUT $seconds 'ScreenSaveTimeOut'
Apply-Spi $SPI_SETSCREENSAVEACTIVE  1        'ScreenSaveActive'
Apply-Spi $SPI_SETSCREENSAVESECURE  1        'ScreenSaverIsSecure'

Write-Host ""
Write-Host "Economiseur installe." -ForegroundColor Green
Write-Host "  fichier      : $scr"
Write-Host "  inactivite   : $TimeoutMinutes min"
Write-Host "  verrouillage : par Windows a la reprise"
Write-Host ""
Write-Host "Vous pouvez supprimer le dossier decompresse." -ForegroundColor DarkGray
Write-Host ""
Get-ItemProperty $key | Select-Object 'SCRNSAVE.EXE',ScreenSaveActive,ScreenSaveTimeOut,ScreenSaverIsSecure | Format-List
