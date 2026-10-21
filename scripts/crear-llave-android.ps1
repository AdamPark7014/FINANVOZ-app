<#
.SINOPSIS
    Crea la llave de SUBIDA (upload key) de Finanvoz para Google Play. Se corre UNA sola vez.

.DESCRIPCION
    Genera con keytool (JDK 17) el keystore finanvoz-upload.jks en
    %USERPROFILE%\Documents\LLAVES-ANDROID\FINANVOZ (fuera del repositorio, como ARTA y NEXARA) y deja
    al lado key.properties con storeFile, storePassword, keyAlias y keyPassword. Play App Signing guarda
    la llave FINAL de la app; esta solo firma lo que se SUBE. Si se pierde o se filtra, se pide en Play
    Console un cambio de llave de subida (no se pierde la app).

      - RSA 2048, 10 000 días, alias finanvoz-upload, DN CN=Finanvoz, O=NEXARA, L=Puebla, ST=Puebla, C=MX.
      - Contraseña aleatoria de 32 caracteres alfanuméricos (RNG criptográfico). El keystore es PKCS12,
        el tipo por omisión del JDK 17: usa UNA sola contraseña para almacén y llave, así que
        key.properties lleva la misma en storePassword y keyPassword (Gradle los pide por separado).
      - Las contraseñas pasan a keytool por variable de entorno (-storepass:env / -keypass:env), nunca por
        la línea de comandos ni por el historial.
      - Se niega a sobrescribir. Imprime solo la ruta y la huella SHA-256; nunca contraseñas.

    Después: scripts/subir-secretos-android.ps1 carga los secretos del flujo «Android · Play». La primera
    subida a Play Console registra sola este certificado como llave de subida de la app.

.EJEMPLO
    pwsh -File scripts\crear-llave-android.ps1
#>
[CmdletBinding()]
param(
    [string]$Carpeta = (Join-Path $env:USERPROFILE 'Documents\LLAVES-ANDROID\FINANVOZ'),
    [string]$Jdk = 'C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot',
    [string]$Alias = 'finanvoz-upload',
    [string]$Dn = 'CN=Finanvoz, O=NEXARA, L=Puebla, ST=Puebla, C=MX',
    [int]$Dias = 10000
)

$ErrorActionPreference = 'Stop'
function Fallo($m) { Write-Host "  ERROR: $m" -ForegroundColor Red; exit 1 }

# --- keytool -----------------------------------------------------------------
$keytool = Join-Path $Jdk 'bin\keytool.exe'
if (-not (Test-Path $keytool)) {
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\keytool.exe'))) {
        $keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
    }
    else {
        $cmd = Get-Command keytool -ErrorAction SilentlyContinue
        if (-not $cmd) { Fallo "No encuentro keytool en $Jdk ni en JAVA_HOME ni en el PATH." }
        $keytool = $cmd.Source
    }
}

# --- Rutas (nunca se sobrescribe una llave) ----------------------------------
$rutaJks = Join-Path $Carpeta 'finanvoz-upload.jks'
$rutaProps = Join-Path $Carpeta 'key.properties'
if (Test-Path $rutaJks) {
    Fallo "Ya existe $rutaJks. Una llave de subida nueva NO puede actualizar la app en Play; si de verdad hay que reemplazarla, respáldala y bórrala a mano primero."
}
if (Test-Path $rutaProps) { Fallo "Ya existe $rutaProps. Respáldalo y bórralo a mano si quieres regenerar la llave." }
if (-not (Test-Path $Carpeta)) { New-Item -ItemType Directory -Path $Carpeta -Force | Out-Null }

# --- Contraseña aleatoria (sin sesgo: GetInt32 sobre el alfabeto) -----------
function New-Contrasena([int]$Largo = 32) {
    $alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    $sb = [System.Text.StringBuilder]::new($Largo)
    for ($i = 0; $i -lt $Largo; $i++) {
        $n = [System.Security.Cryptography.RandomNumberGenerator]::GetInt32($alfabeto.Length)
        [void]$sb.Append($alfabeto[$n])
    }
    return $sb.ToString()
}

# Huella SHA-256 del primer certificado que imprima keytool (la etiqueta «SHA256:» no se traduce aunque
# el JDK esté en español).
function Get-HuellaSha256([string[]]$salida) {
    $m = $salida | Select-String -Pattern 'SHA-?256:\s*([0-9A-F]{2}(?::[0-9A-F]{2}){31})' | Select-Object -First 1
    if (-not $m) { return $null }
    return $m.Matches[0].Groups[1].Value
}

$contrasena = New-Contrasena 32
$env:FINANVOZ_NUEVA_CONTRASENA = $contrasena
try {
    Write-Host "Generando la llave de subida en $rutaJks ..." -ForegroundColor Cyan
    $salida = & $keytool -genkeypair -keystore $rutaJks -storetype PKCS12 -alias $Alias `
        -keyalg RSA -keysize 2048 -validity $Dias -dname $Dn `
        -storepass:env FINANVOZ_NUEVA_CONTRASENA -keypass:env FINANVOZ_NUEVA_CONTRASENA 2>&1
    if ($LASTEXITCODE -ne 0) {
        $salida | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        Fallo "keytool -genkeypair terminó con código $LASTEXITCODE."
    }
    if (-not (Test-Path $rutaJks)) { Fallo 'keytool no dejó el keystore en disco.' }

    $lista = & $keytool -list -v -keystore $rutaJks -storepass:env FINANVOZ_NUEVA_CONTRASENA -alias $Alias 2>&1
    if ($LASTEXITCODE -ne 0) { Fallo "No pude leer la llave recién creada (keytool -list código $LASTEXITCODE)." }
    $huella = Get-HuellaSha256 $lista
    if (-not $huella) { Fallo 'keytool no imprimió la huella SHA-256 del certificado.' }

    # key.properties con barras normales: Java (Gradle) y PowerShell las aceptan y no hay que escapar nada.
    $storeFile = $rutaJks -replace '\\', '/'
    $texto = "storeFile=$storeFile`nstorePassword=$contrasena`nkeyAlias=$Alias`nkeyPassword=$contrasena`n"
    [System.IO.File]::WriteAllText($rutaProps, $texto, [System.Text.UTF8Encoding]::new($false))
}
finally {
    $env:FINANVOZ_NUEVA_CONTRASENA = $null
    $contrasena = $null
    $texto = $null
}

Write-Host ''
Write-Host 'Llave de subida creada:' -ForegroundColor Green
Write-Host "  Keystore:        $rutaJks"
Write-Host "  key.properties:  $rutaProps"
Write-Host "  Alias:           $Alias"
Write-Host "  SHA-256:         $huella"
Write-Host ''
Write-Host 'Siguiente paso (Adam): pwsh -File scripts\subir-secretos-android.ps1' -ForegroundColor Cyan
Write-Host 'Respalda la carpeta LLAVES-ANDROID\FINANVOZ fuera de esta PC; no entra al repositorio.'
