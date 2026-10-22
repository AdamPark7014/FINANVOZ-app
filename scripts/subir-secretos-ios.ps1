<#
.SINOPSIS
    Carga en el repo FINANVOZ-app los secretos que necesita «iOS · TestFlight».

.DESCRIPCION
    Finanvoz se publica con el MISMO equipo de Apple que NEXARA y ARTA (AHNW9K8745), así que
    reusa su certificado de distribución y su llave de App Store Connect y los publica como
    secretos de ESTE repo (GitHub no deja copiar secretos de un repo a otro).
    Ningún valor se imprime ni queda en el historial de PowerShell. No pregunta nada.

    De dónde sale cada uno (carpeta por omisión C:\dev\secrets\arta-ios, la que ya usa ARTA):

      APP_STORE_CONNECT_KEY_ID       del nombre AuthKey_XXXXXXXXXX.p8 (hoy H7VXTV487C, «GitHub Actions ARTA»)
      APP_STORE_CONNECT_ISSUER_ID    -IssuerId; App Store Connect > Usuarios y acceso > Integraciones > API
      APP_STORE_CONNECT_PRIVATE_KEY  el texto del .p8
      CERTIFICATE_PRIVATE_KEY        la llave privada PEM del certificado (*_distribution.key)
      DISTRIBUTION_CERT_CER_BASE64   el certificado de distribución en base64 (*_distribution.cer.base64.txt)

    Antes de subir comprueba que el certificado y la llave privada son pareja (compara la huella de la
    clave pública; solo imprime SI/NO). La forma .p12 + contraseña también la acepta el flujo, pero no
    hay .p12 en disco: no se usa.

    La llave de App Store Connect necesita rol Admin, o Gestor de apps con acceso a
    «Certificates, Identifiers & Profiles»: el flujo crea el perfil de com.finanvoz.app con ella
    (scripts/asc_signing.py).

.EJEMPLO
    pwsh -File scripts\subir-secretos-ios.ps1 -IssuerId (Get-Content C:\dev\secrets\arta-ios\issuer-id.txt)
#>
[CmdletBinding()]
param(
    [string]$Repo = 'AdamPark7014/FINANVOZ-app',
    [string]$Carpeta = 'C:\dev\secrets\arta-ios',
    [Parameter(Mandatory)][string]$IssuerId
)

$ErrorActionPreference = 'Stop'
function Fallo($m) { Write-Host "  ERROR: $m" -ForegroundColor Red; exit 1 }

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Fallo "No hay 'gh' en el PATH. Instala GitHub CLI: https://cli.github.com"
}
if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
    Fallo "No hay 'openssl' en el PATH (viene con Git for Windows)."
}
& gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  GitHub CLI no tiene sesión. Ejecuta primero:  gh auth login" -ForegroundColor Yellow
    exit 1
}
if ($IssuerId -notmatch '^[0-9a-fA-F-]{36}$') { Fallo 'El Issuer ID debe ser un UUID de 36 caracteres.' }

$p8 = Get-ChildItem -Path $Carpeta -Filter 'AuthKey_*.p8' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $p8) { Fallo "Falta AuthKey_XXXXXXXXXX.p8 en $Carpeta." }
$keyId = $p8.BaseName -replace '^AuthKey_', ''

$llave = Get-ChildItem -Path $Carpeta -Filter '*_distribution.key' -ErrorAction SilentlyContinue | Select-Object -First 1
$cer = Get-ChildItem -Path $Carpeta -Filter '*_distribution.cer' -ErrorAction SilentlyContinue | Select-Object -First 1
$cerB64 = Get-ChildItem -Path $Carpeta -Filter '*_distribution.cer.base64.txt' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $llave -or -not $cer -or -not $cerB64) {
    Fallo "En $Carpeta faltan *_distribution.key, *_distribution.cer o *_distribution.cer.base64.txt."
}

# Pareja certificado/llave: huella SHA-256 de la clave pública de cada uno. No se imprime ninguna.
$huellaCert = (& openssl x509 -inform DER -in $cer.FullName -noout -pubkey | & openssl sha256) -replace '^.*= ', ''
$huellaLlave = (& openssl pkey -in $llave.FullName -pubout | & openssl sha256) -replace '^.*= ', ''
if (-not $huellaCert -or $huellaCert -ne $huellaLlave) {
    Fallo "El certificado $($cer.Name) no corresponde a la llave $($llave.Name)."
}
Write-Host "Certificado y llave privada son pareja: SI ($($cer.Name))" -ForegroundColor DarkGray
Write-Host "Llave de App Store Connect: $($p8.Name) -> APP_STORE_CONNECT_KEY_ID = $keyId" -ForegroundColor DarkGray

function Poner([string]$nombre, [string]$valor) {
    # Por stdin: el valor no aparece en la línea de comandos ni en el historial.
    $valor | & gh secret set $nombre --repo $Repo 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fallo "No se pudo guardar $nombre en $Repo." }
    Write-Host "  ok  $nombre" -ForegroundColor Green
}

Write-Host "Cargando secretos en $Repo ..."
Poner 'APP_STORE_CONNECT_KEY_ID' $keyId
Poner 'APP_STORE_CONNECT_ISSUER_ID' $IssuerId
Poner 'APP_STORE_CONNECT_PRIVATE_KEY' (Get-Content -Raw $p8.FullName)
Poner 'CERTIFICATE_PRIVATE_KEY' (Get-Content -Raw $llave.FullName)
Poner 'DISTRIBUTION_CERT_CER_BASE64' (((Get-Content -Raw $cerB64.FullName) -replace '\s', ''))

Write-Host ''
Write-Host 'Listo. Lanza «iOS · TestFlight» en GitHub Actions (la app ya existe en App Store Connect: 6825850016).' -ForegroundColor Cyan
