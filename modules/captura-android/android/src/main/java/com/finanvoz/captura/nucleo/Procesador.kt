package com.finanvoz.captura.nucleo

/**
 * `onNotificationPosted` sin Android (`07 §2.2`):
 *
 * 1. Paquete fuera de la lista blanca → se descarta **sin leer nada más** ni escribir nada
 *    (salvo +1 al contador anónimo si el diagnóstico está activo).
 * 2. Resúmenes de grupo y notificaciones en curso → se ignoran.
 * 3. Extrae `{clave, etiqueta, paquete, titulo, texto, publicada_en, cuando}`.
 * 4. La agrega a la cola (sin repetir la misma notificación).
 *
 * Devuelve la notificación encolada (para avisar a JS) o `null`.
 */
class Procesador(
  private val filtro: Filtro,
  private val cola: Cola,
  private val diagnostico: Diagnostico? = null,
  private val alVerAutorizada: (() -> Unit)? = null,
) {
  fun procesar(f: FuenteNotificacion): NotificacionCruda? {
    val paquete = when (val d = filtro.decidir(f)) {
      Filtro.Decision.NoAutorizada -> {
        diagnostico?.registrarNoAutorizada()
        return null
      }
      is Filtro.Decision.Autorizada -> d.paquete
    }
    // Cualquier notificación de un banco autorizado prueba que el servicio sigue vivo
    // (detección de captura inactiva, RF-CAP-07).
    alVerAutorizada?.invoke()
    if (f.esResumenDeGrupo()) {
      diagnostico?.registrar(paquete, f, Resultado.RESUMEN_GRUPO, null)
      return null
    }
    if (f.enCurso()) {
      diagnostico?.registrar(paquete, f, Resultado.EN_CURSO, null)
      return null
    }
    val n = Extractor.extraer(f, paquete)
    val agregada = cola.agregar(n)
    diagnostico?.registrar(paquete, f, if (agregada) Resultado.ENCOLADA else Resultado.REPETIDA, n)
    return if (agregada) n else null
  }
}
