package com.finanvoz.captura.nucleo

/**
 * Notificación tal como la ve la ingesta de JS (`03 §5.2`, `07 §2.3`):
 * `{clave, etiqueta, paquete, titulo, texto, publicada_en, cuando}`.
 *
 * - `clave`: `sbn.key`.
 * - `etiqueta`: `sbn.tag` (puede faltar).
 * - `paquete`: paquete de la app de banco (en depuración, el que corresponde a la etiqueta de `adb`).
 * - `titulo`: `EXTRA_TITLE` ("" si falta).
 * - `texto`: `EXTRA_BIG_TEXT`, o `EXTRA_TEXT` si no hay ("" si faltan los dos).
 * - `publicadaEn`: `sbn.postTime` (ms desde época).
 * - `cuando`: `notification.when` si es mayor que 0; si no, `postTime` (`07 §2.4`).
 */
data class NotificacionCruda(
  val clave: String,
  val etiqueta: String?,
  val paquete: String,
  val titulo: String,
  val texto: String,
  val publicadaEn: Long,
  val cuando: Long,
) {
  /**
   * Identidad dentro de la cola: los mismos campos que entran a la huella de la ingesta
   * (`paquete | clave | cuando | titulo | texto`). Dos entradas con la misma identidad son la
   * misma notificación leída dos veces; con cualquier campo distinto son eventos distintos y se
   * conservan (un banco puede reutilizar `sbn.key` para cada compra).
   */
  fun identidad(): List<Any> = listOf(paquete, clave, cuando, titulo, texto)

  fun aMapa(): Map<String, Any?> = linkedMapOf(
    "clave" to clave,
    "etiqueta" to etiqueta,
    "paquete" to paquete,
    "titulo" to titulo,
    "texto" to texto,
    "publicada_en" to publicadaEn,
    "cuando" to cuando,
  )

  fun aLineaJson(): String = Json.escribir(aMapa())

  companion object {
    /** Convierte un mapa (de una línea de la cola o de JS) en notificación; `null` si no es válido. */
    fun deMapa(m: Map<*, *>): NotificacionCruda? {
      val clave = m["clave"] as? String ?: return null
      val paquete = m["paquete"] as? String ?: return null
      val titulo = m["titulo"] as? String ?: return null
      val texto = m["texto"] as? String ?: return null
      val etiqueta = m["etiqueta"]
      if (etiqueta != null && etiqueta !is String) return null
      val publicadaEn = entero(m["publicada_en"]) ?: return null
      val cuando = entero(m["cuando"]) ?: return null
      return NotificacionCruda(clave, etiqueta as String?, paquete, titulo, texto, publicadaEn, cuando)
    }

    fun deLineaJson(linea: String): NotificacionCruda? {
      val v = try {
        Json.leer(linea)
      } catch (e: Json.ErrorJson) {
        return null
      }
      return (v as? Map<*, *>)?.let { deMapa(it) }
    }

    private fun entero(v: Any?): Long? = when (v) {
      is Long -> v
      is Int -> v.toLong()
      is Double -> if (v.isFinite() && v == Math.floor(v)) v.toLong() else null
      else -> null
    }
  }
}

/**
 * Lo que el servicio sabe de una notificación publicada. En Android lo implementa un
 * adaptador sobre `StatusBarNotification`; en pruebas, un doble que cuenta qué se leyó.
 *
 * `paquete` es lo único que se lee antes de decidir si la app está autorizada
 * (regla 10 de `CLAUDE.md`, `07 §2.2` paso 1).
 */
interface FuenteNotificacion {
  val paquete: String
  fun etiqueta(): String?
  fun clave(): String
  fun publicadaEn(): Long
  fun cuandoBruto(): Long
  fun esResumenDeGrupo(): Boolean
  fun enCurso(): Boolean
  fun titulo(): CharSequence?
  fun textoGrande(): CharSequence?
  fun texto(): CharSequence?
  /** Nombres de los extras presentes (solo para el resumen de diagnóstico; nunca sus valores). */
  fun nombresDeExtras(): Set<String>
}
