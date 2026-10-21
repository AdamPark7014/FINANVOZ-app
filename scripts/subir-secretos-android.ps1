<#
.SINOPSIS
    Carga en el repo FINANVOZ-app los secretos que necesita «Android · Play».

.DESCRIPCION
    Toma la llave de subida que dejó scripts/crear-llave-android.ps1 en
    %USERPROFILE%\Documents\LLAVES-ANDROID\FINANVOZ (finanvoz-upload.jks + key.properties) y la publica
    como secretos de ESTE repo con `gh secret set` por stdin. Ningún valor se imprime ni queda en el
    historial de PowerShell ni en la línea de comandos.

    Secretos que carga (los nombres que lee .github/workflows/android-play.yml):

      ANDROID_UPLOAD_KEYSTORE_BASE64   el .jks en base64
      ANDROID_KEYSTORE_PASSWORD        storePassword de key.properties
      ANDROID_KEY_ALIAS                keyAlias de key.properties (finanvoz-upload)
      ANDROID_KEY_PASSWORD             keyPassword de key.properties

    Lo corre Adam (custodia de llaves). Requiere GitHub CLI con sesión (gh auth login).

.EJEMPLO
    pwsh -File scripts\subir-secretos-android.ps1
#>
[CmdletBinding()]
param(
    [string]$Repo = 'AdamPark7014/FINANVOZ-app',
    [string]$Carpeta = (Join-Path $env:USERPROFILE 'Documents\LLAVES-ANDROID\FINANVOZ')
)

$ErrorActionPreference = 'Stop'
function Fallo($m) { Write-Host "  ERROR: $m" -ForegroundColor Red; exit 1 }

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Fallo "No hay 'gh' en el PATH. Instala GitHub CLI: https://cli.github.com"
}
& gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  GitHub CLI no tiene sesión. Ejecuta primero:  gh auth login" -ForegroundColor Yellow
    exit 1
}

$rutaJks = Join-Path $Carpeta 'finanvoz-upload.jks'
$rutaProps = Join-Path $Carpeta 'key.properties'
if (-not (Test-Path $rutaJks)) { Fallo "No encuentro $rutaJks (lo genera scripts/crear-llave-android.ps1)." }
if (-not (Test-Path $rutaProps)) { Fallo "No encuentro $rutaProps (lo genera scripts/crear-llave-android.ps1)." }

# key.properties: clave=valor por línea; los valores se usan tal cual (el generador escribe la ruta con /).
function Read-KeyProperties([string]$ruta) {
    $props = @{}
    foreach ($linea in [System.IO.File]::ReadAllLines($ruta)) {
        $l = $linea.Trim()
        if ($l -eq '' -or $l.StartsWith('#') -or $l.StartsWith('!')) { continue }
        $i = $l.IndexOf('=')
        if ($i -lt 1) { continue }
        $props[$l.Substring(0, $i).Trim()] = $l.Substring($i + 1).Trim()
    }
    return $props
}

$props = Read-KeyProperties $rutaProps
foreach ($campo in 'storePassword', 'keyAlias', 'keyPassword') {
    if (-not $props[$campo]) { Fallo "key.properties no trae $campo." }
}
Write-Host "Llave de subida: $rutaJks (alias $($props.keyAlias))" -ForegroundColor DarkGray

function Poner([string]$nombre, [string]$valor) {
    # Por stdin: el valor no aparece en la línea de comandos ni en el historial.
    $valor | & gh secret set $nombre --repo $Repo 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fallo "No se pudo guardar $nombre en $Repo." }
    Write-Host "  ok  $nombre" -ForegroundColor Green
}

$base64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($rutaJks))
try {
    Write-Host "Cargando secretos en $Repo ..."
    Poner 'ANDROID_UPLOAD_KEYSTORE_BASE64' $base64
    Poner 'ANDROID_KEYSTORE_PASSWORD' $props.storePassword
    Poner 'ANDROID_KEY_ALIAS' $props.keyAlias
    Poner 'ANDROID_KEY_PASSWORD' $props.keyPassword
}
finally {
    $base64 = $null
    $props = $null
}

Write-Host ''
Write-Host 'Listo. Lanza «Android · Play» en GitHub (Actions > Android · Play > Run workflow) con la versión' -ForegroundColor Cyan
Write-Host 'y el versionCode; el .aab queda en el artefacto finanvoz-aab. En Play Console crea la app com.finanvoz.app'
Write-Host 'con Play App Signing (por omisión): la primera subida registra este certificado como llave de subida.'
