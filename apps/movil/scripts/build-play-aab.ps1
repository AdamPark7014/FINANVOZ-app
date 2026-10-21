<#
.SINOPSIS
    Compila en esta PC el Android App Bundle (.aab) de Finanvoz firmado con la llave de subida de Play.

.DESCRIPCION
    Alternativa local al flujo «Android · Play» de GitHub (.github/workflows/android-play.yml). Hace lo mismo:

      1. Lee key.properties de %USERPROFILE%\Documents\LLAVES-ANDROID\FINANVOZ (lo deja
         scripts/crear-llave-android.ps1) y exporta FINANVOZ_KEYSTORE_PATH / _PASSWORD / KEY_ALIAS /
         KEY_PASSWORD solo en este proceso.
      2. `pnpm exec expo prebuild --platform android --no-install --clean` con APP_VERSION y
         APP_BUILD_NUMBER: app.config.ts los vuelca en versionName/versionCode y el plugin
         apps/movil/plugins/con-firma-android.js inyecta la firma de release en android/app/build.gradle.
      3. `gradlew.bat bundleRelease --no-daemon` (NODE_ENV=production y SENTRY_DISABLE_AUTO_UPLOAD=true
         solo en ese paso).
      4. Comprueba con keytool que el AAB va firmado con la llave de subida y NO con la de debug
         (solo se imprimen huellas SHA-256, nunca contraseñas).
      5. Copia el AAB (y mapping.txt si R8 está activo) a %USERPROFILE%\Documents\FINANVOZ-builds\
         finanvoz-<version>-<build>.aab.

    Play NUNCA reutiliza un versionCode, aunque el bundle se descartara: pasa uno mayor en cada subida.
    Con -WhatIf solo muestra lo que haría (sin prebuild, sin Gradle, sin copiar).

.EJEMPLO
    pwsh -File apps\movil\scripts\build-play-aab.ps1 -Version 1.0.0 -Build 2
    pwsh -File apps\movil\scripts\build-play-aab.ps1 -Version 1.0.1 -Build 3 -Force
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$Version = '1.0.0',
    [int]$Build = 0,
    [string]$Carpeta = (Join-Path $env:USERPROFILE 'Documents\LLAVES-ANDROID\FINANVOZ'),
    [string]$Salida = (Join-Path $env:USERPROFILE 'Documents\FINANVOZ-builds'),
    [string]$Jdk = 'C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot',
    # Sobrescribe un finanvoz-<version>-<build>.aab que ya exista en la carpeta de salida.
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
function Fallo($m) { Write-Host "  ERROR: $m" -ForegroundColor Red; exit 1 }

$movil = Split-Path -Parent $PSScriptRoot            # apps/movil
$android = Join-Path $movil 'android'
$gradleApp = Join-Path $android 'app\build.gradle'
$aab = Join-Path $android 'app\build\outputs\bundle\release\app-release.aab'
$mapping = Join-Path $android 'app\build\outputs\mapping\release\mapping.txt'
$debugKeystore = Join-Path $android 'app\debug.keystore'

# --- Entradas -----------------------------------------------------------------
if ($Version -notmatch '^\d+\.\d+\.\d+$') { Fallo "La versión «$Version» no tiene la forma MAYOR.MENOR.PARCHE." }
if ($Build -le 0) { Fallo 'Pasa -Build <entero positivo>: Play exige un versionCode mayor que el último subido.' }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { Fallo 'No hay pnpm en el PATH.' }

$rutaProps = Join-Path $Carpeta 'key.properties'
if (-not (Test-Path $rutaProps)) { Fallo "Falta $rutaProps. Lo genera scripts/crear-llave-android.ps1 (una sola vez); no crees otra llave si ya hay una registrada en Play." }

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
foreach ($campo in 'storeFile', 'storePassword', 'keyAlias', 'keyPassword') {
    if (-not $props[$campo]) { Fallo "key.properties no trae $campo." }
}
$rutaJks = $props.storeFile
if (-not [System.IO.Path]::IsPathRooted($rutaJks)) { $rutaJks = Join-Path $Carpeta $rutaJks }
if (-not (Test-Path $rutaJks)) { Fallo "No encuentro el keystore $rutaJks que indica key.properties." }

# --- keytool y JDK ------------------------------------------------------------
if (Test-Path (Join-Path $Jdk 'bin\java.exe')) { $env:JAVA_HOME = $Jdk }
elseif (-not $env:JAVA_HOME) { Fallo "No encuentro el JDK en $Jdk y JAVA_HOME no está definido." }
$keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
if (-not (Test-Path $keytool)) { Fallo "No encuentro $keytool." }

function Get-HuellaSha256([string[]]$salida) {
    $m = $salida | Select-String -Pattern 'SHA-?256:\s*([0-9A-F]{2}(?::[0-9A-F]{2}){31})' | Select-Object -First 1
    if (-not $m) { return $null }
    return $m.Matches[0].Groups[1].Value
}

$nombreSalida = "finanvoz-$Version-$Build.aab"
$rutaSalida = Join-Path $Salida $nombreSalida
if ((Test-Path $rutaSalida) -and -not $Force) {
    Fallo "Ya existe $rutaSalida. Si ese AAB se subió a Play usa un -Build mayor; si nunca se subió, repite con -Force."
}

Write-Host ''
Write-Host "Finanvoz · AAB versionName=$Version versionCode=$Build" -ForegroundColor White
Write-Host "  Llave de subida: $rutaJks (alias $($props.keyAlias))" -ForegroundColor DarkGray
Write-Host "  Salida:          $rutaSalida" -ForegroundColor DarkGray
Write-Host ''

# Las variables viven solo en este proceso; se limpian al final pase lo que pase.
$env:FINANVOZ_KEYSTORE_PATH = $rutaJks
$env:FINANVOZ_KEYSTORE_PASSWORD = $props.storePassword
$env:FINANVOZ_KEY_ALIAS = $props.keyAlias
$env:FINANVOZ_KEY_PASSWORD = $props.keyPassword
$env:APP_VERSION = $Version
$env:APP_BUILD_NUMBER = "$Build"
$props = $null

try {
    # --- 1. Proyecto nativo con la firma de release ---------------------------
    if ($PSCmdlet.ShouldProcess($movil, 'pnpm exec expo prebuild --platform android --no-install --clean')) {
        Push-Location $movil
        try {
            & pnpm exec expo prebuild --platform android --no-install --clean
            if ($LASTEXITCODE -ne 0) { Fallo "expo prebuild terminó con código $LASTEXITCODE." }
        }
        finally { Pop-Location }
        $gradle = [System.IO.File]::ReadAllText($gradleApp)
        if ($gradle -notmatch 'signingConfig signingConfigs\.release') {
            Fallo 'El plugin con-firma-android no inyectó la firma en android/app/build.gradle.'
        }
        if ($gradle -notmatch "versionCode $Build\b") { Fallo "android/app/build.gradle no trae versionCode $Build (¿app.config.ts cambió?)." }
    }

    # --- 2. bundleRelease ------------------------------------------------------
    if ($PSCmdlet.ShouldProcess($android, 'gradlew.bat bundleRelease --no-daemon')) {
        if (Test-Path $aab) { Remove-Item $aab -Force }   # que no quede un bundle viejo si el build falla
        Push-Location $android
        try {
            $env:NODE_ENV = 'production'
            $env:SENTRY_DISABLE_AUTO_UPLOAD = 'true'
            & .\gradlew.bat bundleRelease --no-daemon
            if ($LASTEXITCODE -ne 0) { Fallo "bundleRelease terminó con código $LASTEXITCODE." }
        }
        finally {
            Pop-Location
            $env:NODE_ENV = $null
            $env:SENTRY_DISABLE_AUTO_UPLOAD = $null
        }
        if (-not (Test-Path $aab)) { Fallo "No se generó $aab." }
    }

    # --- 3. Verificar la firma ---------------------------------------------------
    if ($PSCmdlet.ShouldProcess($aab, 'verificar la firma con keytool')) {
        $huellaAab = Get-HuellaSha256 (& $keytool -printcert -jarfile $aab 2>&1)
        $huellaSubida = Get-HuellaSha256 (& $keytool -list -v -keystore $rutaJks -storepass:env FINANVOZ_KEYSTORE_PASSWORD -alias $env:FINANVOZ_KEY_ALIAS 2>&1)
        $huellaDebug = $null
        if (Test-Path $debugKeystore) {
            # La contraseña del keystore de debug es la pública de Android («android»).
            $huellaDebug = Get-HuellaSha256 (& $keytool -list -v -keystore $debugKeystore -storepass android -alias androiddebugkey 2>&1)
        }
        if (-not $huellaAab) { Fallo 'El AAB no está firmado (keytool no encontró certificado).' }
        if (-not $huellaSubida) { Fallo 'No pude leer la huella de la llave de subida.' }
        if ($huellaDebug -and $huellaAab -eq $huellaDebug) { Fallo "El AAB está firmado con la llave de DEBUG ($huellaAab). No lo subas." }
        if ($huellaAab -ne $huellaSubida) { Fallo "La firma del AAB ($huellaAab) no coincide con la llave de subida ($huellaSubida)." }

        # --- 4. Copiar a la carpeta de builds -------------------------------------
        if (-not (Test-Path $Salida)) { New-Item -ItemType Directory -Path $Salida -Force | Out-Null }
        Copy-Item $aab $rutaSalida -Force
        if (Test-Path $mapping) {
            Copy-Item $mapping (Join-Path $Salida "finanvoz-$Version-$Build-mapping.txt") -Force
        }
        else {
            Write-Host 'AVISO: no hay mapping.txt (R8 apagado: android.enableMinifyInReleaseBuilds=false).' -ForegroundColor Yellow
        }

        $item = Get-Item $rutaSalida
        Write-Host ''
        Write-Host 'AAB listo y verificado:' -ForegroundColor Green
        Write-Host "  $($item.FullName)"
        Write-Host "  versionName: $Version   versionCode: $Build"
        Write-Host "  Tamaño: $([math]::Round($item.Length / 1MB, 2)) MB"
        Write-Host "  SHA-256 del archivo: $((Get-FileHash $rutaSalida -Algorithm SHA256).Hash)"
        Write-Host "  Certificado (llave de subida) SHA-256: $huellaAab"
        if ($huellaDebug) { Write-Host "  (distinto del de debug: $huellaDebug)" -ForegroundColor DarkGray }
        Write-Host ''
        Write-Host 'Siguiente paso: Play Console -> com.finanvoz.app -> Prueba interna o Producción -> Crear versión -> subir este .aab.'
    }
}
finally {
    foreach ($v in 'FINANVOZ_KEYSTORE_PATH', 'FINANVOZ_KEYSTORE_PASSWORD', 'FINANVOZ_KEY_ALIAS', 'FINANVOZ_KEY_PASSWORD', 'APP_VERSION', 'APP_BUILD_NUMBER') {
        [System.Environment]::SetEnvironmentVariable($v, $null)
    }
}
