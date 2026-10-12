package com.finanvoz.captura

/**
 * Build de depuración: acepta `adb shell cmd notification post` con la etiqueta de un banco
 * sintético (`07 §2.5`) y permite las muestras del modo diagnóstico (`07 §4`).
 */
internal object Variante {
  const val DEPURACION: Boolean = true
}
