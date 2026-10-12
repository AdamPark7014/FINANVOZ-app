package com.finanvoz.captura.nucleo

/** Paquete desde el que publica `adb shell cmd notification post`. */
const val PAQUETE_SHELL = "com.android.shell"

/** Largo máximo que se guarda de título y texto (una notificación de banco cabe de sobra). */
const val LARGO_MAXIMO = 4096

/**
 * Lista blanca efectiva: lo que el usuario marcó ∩ catálogo. Un paquete fuera del catálogo
 * nunca se lee aunque esté guardado (conservador ante preferencias manipuladas o catálogos que
 * cambian entre versiones).
 *
 * @param mapeoDepuracion solo en builds de depuración: etiqueta de `adb` (`banco_a`…) →
 *   paquete del banco. `null` en producción: ahí `com.android.shell` es una app más, no
 *   autorizada.
 */
class Filtro(
  autorizados: Set<String>,
  catalogo: Catalogo,
  private val mapeoDepuracion: Map<String, String>? = null,
) {
  val efectivos: Set<String> = autorizados.filter { it in catalogo.paquetes }.toSet()

  sealed interface Decision {
    /** App no autorizada: no se leyó nada más que el paquete y no se guarda nada. */
    data object NoAutorizada : Decision
    data class Autorizada(val paquete: String) : Decision
  }

  /** Lee solo `paquete` (y la etiqueta si es `adb` en depuración). */
  fun decidir(f: FuenteNotificacion): Decision {
    val paquete = f.paquete
    if (paquete in efectivos) return Decision.Autorizada(paquete)
    if (paquete == PAQUETE_SHELL && mapeoDepuracion != null) {
      val mapeado = f.etiqueta()?.let { mapeoDepuracion[it] }
      if (mapeado != null && mapeado in efectivos) return Decision.Autorizada(mapeado)
    }
    return Decision.NoAutorizada
  }

  companion object {
    /** Etiqueta de `adb` → primer paquete del banco con ese `id`. */
    fun mapeoDesde(catalogoDepuracion: Catalogo): Map<String, String> =
      catalogoDepuracion.bancos.mapNotNull { b -> b.paquetes.firstOrNull()?.let { b.id to it } }.toMap()
  }
}

/** Extrae los campos de `07 §2.2` paso 3 de una notificación ya autorizada. */
object Extractor {
  fun extraer(f: FuenteNotificacion, paquete: String): NotificacionCruda {
    val publicadaEn = f.publicadaEn()
    val bruto = f.cuandoBruto()
    val texto = f.textoGrande()?.toString()?.takeIf { it.isNotEmpty() } ?: f.texto()?.toString() ?: ""
    return NotificacionCruda(
      clave = f.clave(),
      etiqueta = f.etiqueta(),
      paquete = paquete,
      titulo = (f.titulo()?.toString() ?: "").take(LARGO_MAXIMO),
      texto = texto.take(LARGO_MAXIMO),
      publicadaEn = publicadaEn,
      cuando = if (bruto > 0) bruto else publicadaEn,
    )
  }
}
