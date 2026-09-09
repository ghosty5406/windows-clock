<#
.SYNOPSIS
  Declenche l'economiseur d'ecran tout de suite.

.DESCRIPTION
  On ne lance pas le .scr nous-memes : on demande a Windows de lancer celui
  qui est configure (WM_SYSCOMMAND / SC_SCREENSAVE, exactement ce que fait le
  systeme au bout du delai d'inactivite). C'est la seule facon d'obtenir le
  verrouillage : winlogon ne verrouille a la reprise que s'il a lui-meme lance
  l'economiseur.

  L'installeur compile normalement Veille.exe, qui fait la meme chose sans
  fenetre ni latence. Ce script est le filet de secours quand la compilation
  n'est pas possible.
#>

Add-Type -Namespace Veille -Name Native -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true)]
public static extern bool PostMessage(System.IntPtr hWnd, uint msg, System.IntPtr wParam, System.IntPtr lParam);
'@

$HWND_BROADCAST = [IntPtr]0xFFFF
$WM_SYSCOMMAND  = 0x0112
$SC_SCREENSAVE  = [IntPtr]0xF140

[void][Veille.Native]::PostMessage($HWND_BROADCAST, $WM_SYSCOMMAND, $SC_SCREENSAVE, [IntPtr]::Zero)
