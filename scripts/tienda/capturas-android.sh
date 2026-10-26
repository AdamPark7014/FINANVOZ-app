#!/usr/bin/env bash
# Capturas de tienda en un emulador Android que ya está arrancado (lo usa android-capturas.yml dentro de
# reactivecircus/android-emulator-runner; también sirve en esta PC con un emulador local).
#
#   APK=finanvoz.apk SALIDA=maestro-capturas-android bash scripts/tienda/capturas-android.sh
#
# Variables: APK (obligatoria, x86_64 para el emulador), SALIDA (carpeta de PNG; claro/ y oscuro/), MAESTRO
# (ejecutable; `maestro` o la ruta a maestro.bat), FLUJO (por omisión scripts/tienda/maestro/android-capturas.yaml),
# ANDROID_SERIAL (si hay más de un dispositivo), SIN_INSTALAR=1 (repetir en local con la app ya instalada). Deja el
# teléfono en es-MX, hora de México, barra de estado en modo demo (10:00, batería llena, señal llena, sin
# notificaciones), instala el APK y corre el flujo en claro y en oscuro.
set -euo pipefail

APK="${APK:?Falta APK (ruta al .apk x86_64)}"
SALIDA="${SALIDA:-maestro-capturas-android}"
MAESTRO="${MAESTRO:-maestro}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLUJO="${FLUJO:-$AQUI/maestro/android-capturas.yaml}"
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"

esperar_arranque() {
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 2; done
}

barra_demo() {
  adb shell settings put global sysui_demo_allowed 1
  adb shell am broadcast -a com.android.systemui.demo -e command enter >/dev/null
  adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1000 >/dev/null
  adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false >/dev/null
  adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4 >/dev/null
  adb shell am broadcast -a com.android.systemui.demo -e command network -e mobile show -e datatype none -e level 4 >/dev/null
  adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false >/dev/null
}

echo "== Español de México y hora de México"
esperar_arranque
if adb root >/dev/null 2>&1; then
  sleep 3
  adb wait-for-device
  LOCALE="$(adb shell getprop persist.sys.locale | tr -d '\r')"
  if [ "$LOCALE" != es-MX ]; then
    adb shell "setprop persist.sys.locale es-MX; setprop persist.sys.timezone America/Mexico_City; setprop ctl.restart zygote"
    sleep 15
    esperar_arranque
    sleep 10
  fi
else
  echo "AVISO: sin adb root (imagen playstore): el idioma del sistema se queda como está"
fi
adb shell getprop persist.sys.locale
barra_demo

if [ -n "${SIN_INSTALAR:-}" ]; then
  echo "== SIN_INSTALAR: uso el com.finanvoz.app que ya está en el dispositivo"
  adb shell pm list packages | grep -q com.finanvoz.app || { echo "no está instalado"; exit 1; }
else
  echo "== Instalar $APK"
  adb install -r -g "$APK"
fi

correr() { # tema · devuelve el estado de Maestro (las capturas se listan aunque falle)
  local tema="$1" estado=0
  mkdir -p "$SALIDA/$tema"
  (
    cd "$SALIDA/$tema"
    # Con varios dispositivos conectados (esta PC), ANDROID_SERIAL también elige el de Maestro.
    # TEMA=oscuro: la app es clara aunque el teléfono esté en oscuro (02 §16); el onboarding rápido elige «Oscuro»
    # en Tú › Apariencia (apps/movil/.maestro/ios/subflujos/tema-oscuro.yaml).
    "$MAESTRO" ${ANDROID_SERIAL:+--device "$ANDROID_SERIAL"} test --include-tags capturas -e TEMA="$tema" \
      --format junit --output "junit-$tema.xml" \
      --test-output-dir "fallos" --debug-output "registro" "$FLUJO" 2>&1 | tee "maestro-$tema.log"
  ) || estado=$?
  echo "Capturas en $SALIDA/$tema:"
  ls -1 "$SALIDA/$tema"/*.png 2>/dev/null || echo "(ninguna)"
  return "$estado"
}

echo "== Tema claro"
adb shell cmd uimode night no >/dev/null
barra_demo
# Si el claro falla, el oscuro corre igual (sus capturas también sirven) y el script sale con error al final.
estado_claro=0
correr claro || estado_claro=$?

echo "== Tema oscuro"
adb shell cmd uimode night yes >/dev/null
sleep 3
barra_demo
correr oscuro || echo "AVISO: el lote oscuro falló (no bloquea)"
adb shell cmd uimode night no >/dev/null
adb shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null || true
echo "== Listo: $SALIDA"
exit "$estado_claro"
