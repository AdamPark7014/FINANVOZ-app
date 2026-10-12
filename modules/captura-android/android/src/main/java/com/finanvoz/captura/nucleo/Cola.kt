package com.finanvoz.captura.nucleo

import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile

/** Archivo de líneas donde vive la cola. Separado para poder probar la cola sin disco. */
interface AlmacenLineas {
  fun leerLineas(): List<String>
  fun agregarLinea(linea: String)
  fun reescribir(lineas: List<String>)
}

/**
 * Archivo JSONL en almacenamiento privado (`noBackupFilesDir/captura/cola.jsonl`, `07 §2.2`).
 * Agregar es `append` + `fsync`; reescribir va a un temporal y se renombra (atómico en el mismo
 * directorio), así un cierre a medias nunca deja la cola vacía.
 */
class AlmacenArchivo(private val archivo: File) : AlmacenLineas {
  override fun leerLineas(): List<String> =
    if (!archivo.exists()) emptyList() else archivo.readLines(Charsets.UTF_8).filter { it.isNotBlank() }

  override fun agregarLinea(linea: String) {
    archivo.parentFile?.mkdirs()
    // Si un cierre abrupto dejó la última línea sin '\n', se cierra antes de agregar para no
    // pegar la línea nueva a la rota.
    val necesitaSalto = archivo.exists() && archivo.length() > 0 &&
      RandomAccessFile(archivo, "r").use { it.seek(it.length() - 1); it.read() != '\n'.code }
    FileOutputStream(archivo, true).use { out ->
      val texto = (if (necesitaSalto) "\n" else "") + linea + "\n"
      out.write(texto.toByteArray(Charsets.UTF_8))
      out.fd.sync()
    }
  }

  override fun reescribir(lineas: List<String>) {
    archivo.parentFile?.mkdirs()
    val tmp = File(archivo.parentFile, archivo.name + ".tmp")
    FileOutputStream(tmp, false).use { out ->
      out.write(lineas.joinToString("") { it + "\n" }.toByteArray(Charsets.UTF_8))
      out.fd.sync()
    }
    if (!tmp.renameTo(archivo)) {
      archivo.delete()
      if (!tmp.renameTo(archivo)) throw java.io.IOException("no se pudo reemplazar la cola")
    }
  }
}

/**
 * Cola de notificaciones pendientes de ingerir. El servicio agrega; JS lee y confirma lo que ya
 * ingirió. Toda operación toma el mismo candado: el servicio y el módulo viven en el mismo
 * proceso y comparten la instancia.
 */
class Cola(private val almacen: AlmacenLineas) {
  private val candado = Any()

  /**
   * Agrega si no hay ya una entrada con la misma identidad (la misma notificación vista dos
   * veces, por ejemplo al reconectar el servicio y releer las activas). Devuelve `true` si
   * la agregó.
   */
  fun agregar(n: NotificacionCruda): Boolean = synchronized(candado) {
    val id = n.identidad()
    if (leerSinCandado().any { it.identidad() == id }) return false
    almacen.agregarLinea(n.aLineaJson())
    true
  }

  /** Entradas en orden de llegada; las líneas dañadas se omiten. */
  fun leer(): List<NotificacionCruda> = synchronized(candado) { leerSinCandado() }

  fun tamano(): Int = leer().size

  /**
   * Quita las entradas ya ingeridas (misma identidad que alguna de `procesadas`) y las líneas
   * dañadas. Lo que llegó después de la lectura se conserva aunque comparta `clave`.
   * Devuelve cuántas quitó.
   */
  fun confirmar(procesadas: Collection<NotificacionCruda>): Int = synchronized(candado) {
    if (procesadas.isEmpty()) return 0
    val ids = procesadas.map { it.identidad() }.toHashSet()
    val actuales = leerSinCandado()
    val quedan = actuales.filter { it.identidad() !in ids }
    val quitadas = actuales.size - quedan.size
    if (quitadas > 0 || almacen.leerLineas().size != actuales.size) {
      almacen.reescribir(quedan.map { it.aLineaJson() })
    }
    quitadas
  }

  fun vaciar() = synchronized(candado) { almacen.reescribir(emptyList()) }

  private fun leerSinCandado(): List<NotificacionCruda> =
    almacen.leerLineas().mapNotNull { NotificacionCruda.deLineaJson(it) }
}
