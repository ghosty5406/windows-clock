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

  Un raccourci du menu Demarrer porte une touche de raccourci (Ctrl+Alt+V par
  defaut) qui declenche l'economiseur immediatement, sans attendre le delai.

.EXAMPLE
  .\Installer.ps1
  .\Installer.ps1 -TimeoutMinutes 10
  .\Installer.ps1 -Hotkey 'CTRL+ALT+H'
  .\Installer.ps1 -Hotkey ''            # pas de touche de raccourci
  .\Installer.ps1 -Uninstall
#>
param(
  [int]$TimeoutMinutes = 3,
  [string]$Hotkey = 'CTRL+ALT+V',
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$appName  = 'HorlogeClaude'
$scrName  = "$appName.scr"
$key      = 'HKCU:\Control Panel\Desktop'
$target   = Join-Path $env:LOCALAPPDATA $appName

# Explorer n'enregistre les touches de raccourci que pour les raccourcis poses
# sur le Bureau ou dans le menu Demarrer ; ailleurs le champ est ignore.
$lnkPath  = Join-Path ([Environment]::GetFolderPath('Programs')) 'Horloge - veille immediate.lnk'

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

# --------------------------------------------------- declencheur au clavier ---

# La touche ne lance pas le .scr elle-meme : elle demande a Windows de lancer
# l'economiseur configure, comme il le ferait au bout du delai d'inactivite.
# C'est ce qui donne le verrouillage — winlogon ne verrouille a la reprise que
# s'il a lui-meme lance l'economiseur.
$veilleSource = @'
using System;
using System.Runtime.InteropServices;

static class Veille
{
    [DllImport("user32.dll", SetLastError = true)]
    static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    static void Main()
    {
        // HWND_BROADCAST, WM_SYSCOMMAND, SC_SCREENSAVE
        PostMessage((IntPtr)0xFFFF, 0x0112, (IntPtr)0xF140, IntPtr.Zero);
    }
}
'@

# Compiler evite la seconde de demarrage de PowerShell et la fenetre qui
# clignote a chaque appui. Seul Windows PowerShell (.NET Framework) produit un
# .exe autonome ; sous PowerShell 7 on retombe sur le script.
function Build-Trigger {
  $exe = Join-Path $target 'Veille.exe'
  Remove-Item $exe -Force -ErrorAction SilentlyContinue
  if ($PSVersionTable.PSEdition -eq 'Core') { return $null }
  try {
    Add-Type -TypeDefinition $veilleSource -OutputAssembly $exe -OutputType WindowsApplication
    if (Test-Path $exe) { return $exe }
  } catch {
    Write-Warning "Compilation de Veille.exe impossible ($($_.Exception.Message)) ; repli sur Veille.ps1."
  }
  return $null
}

function Set-Hotkey([string]$combo) {
  Remove-Item $lnkPath -Force -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($combo)) { return $null }

  $exe = Build-Trigger
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($lnkPath)
  if ($exe) {
    $lnk.TargetPath = $exe
    $lnk.Arguments  = ''
  } else {
    $lnk.TargetPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $lnk.Arguments  = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $target 'Veille.ps1')`""
  }
  $lnk.WorkingDirectory = $target
  $lnk.IconLocation     = "$(Join-Path $target $scrName),0"
  $lnk.Description      = 'Lance l''horloge maintenant et verrouille a la reprise'
  $lnk.WindowStyle      = 7          # reduit : rien ne clignote a l'ecran
  $lnk.Hotkey           = $combo
  $lnk.Save()
  return $combo
}

# ------------------------------------------------------------ desinstallation ---

if ($Uninstall) {
  Stop-Screensaver
  Remove-Item $lnkPath -Force -ErrorAction SilentlyContinue
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

$combo = Set-Hotkey $Hotkey

Write-Host ""
Write-Host "Economiseur installe." -ForegroundColor Green
Write-Host "  fichier      : $scr"
Write-Host "  inactivite   : $TimeoutMinutes min"
Write-Host "  verrouillage : par Windows a la reprise"
if ($combo) {
  Write-Host "  raccourci    : $combo (declenchement immediat)"
} else {
  Write-Host "  raccourci    : aucun"
}
Write-Host ""
Write-Host "Vous pouvez supprimer le dossier decompresse." -ForegroundColor DarkGray
Write-Host ""
Get-ItemProperty $key | Select-Object 'SCRNSAVE.EXE',ScreenSaveActive,ScreenSaveTimeOut,ScreenSaverIsSecure | Format-List
