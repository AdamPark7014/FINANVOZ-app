package com.finanvoz.captura.nucleo

import java.io.Closeable
import java.io.IOException
import java.io.InputStream

/**
 * Extracción de texto de estados de cuenta en PDF, en el teléfono (`docs/07-CAPTURA.md §8`, M15). Lo de aquí es
 * lógica pura (límites, lectura acotada, resultados); la biblioteca de PDF entra por [LectorPdf]: PdfBox-Android
 * en la app (`EstadoCuentaPdf.kt`) y Apache PDFBox de la misma versión en las pruebas de la JVM.
 *
 * Regla 9: nada de aquí escribe en logs ni pone el texto en mensajes de error. El texto solo viaja a JS como
 * resultado de la función del módulo; nada se guarda en disco.
 */
sealed class ResultadoPdf {
  /** Texto de cada página, en orden, tal como lo da el extractor (sin normalizar). */
  data class Texto(val paginas: List<String>) : ResultadoPdf()

  /** El PDF tiene contraseña de apertura y no se dio ninguna. */
  object PideContrasena : ResultadoPdf()

  /** Se dio una contraseña y no abre el PDF. */
  object ContrasenaIncorrecta : ResultadoPdf()

  /** No es un PDF o está dañado. */
  object Invalido : ResultadoPdf()

  /** Más de [ExtraccionPdf.MAX_BYTES] bytes o de [ExtraccionPdf.MAX_PAGINAS] páginas. */
  object DemasiadoGrande : ResultadoPdf()

  /** Forma que recibe JS (`apps/movil/src/captura/puente.ts`). */
  fun aMapa(): Map<String, Any?> = when (this) {
    is Texto -> mapOf("resultado" to "texto", "paginas" to paginas)
    PideContrasena -> mapOf("resultado" to "pide_contrasena")
    ContrasenaIncorrecta -> mapOf("resultado" to "contrasena_incorrecta")
    Invalido -> mapOf("resultado" to "invalido")
    DemasiadoGrande -> mapOf("resultado" to "demasiado_grande")
  }
}

/** El PDF está cifrado y la contraseña (o su ausencia) no lo abre. */
class PdfProtegido : Exception()

/** Un documento abierto. Se cierra siempre (libera la memoria del documento descifrado). */
interface DocumentoPdf : Closeable {
  val paginas: Int

  /** Texto de la página `numero` (desde 1), ordenado por posición. */
  fun texto(numero: Int): String
}

/** Adaptador de la biblioteca de PDF. Lanza [PdfProtegido] si la contraseña no abre; cualquier otro error = inválido. */
fun interface LectorPdf {
  fun abrir(bytes: ByteArray, contrasena: String?): DocumentoPdf
}

object ExtraccionPdf {
  /** Un estado de cuenta pesa unos cientos de KB; 20 MB deja margen sin arriesgar la memoria del teléfono. */
  const val MAX_BYTES = 20 * 1024 * 1024

  /** Los estados de cuenta tienen pocas páginas; más que esto no es un estado de cuenta. */
  const val MAX_PAGINAS = 60

  /** Lee todo `entrada` si cabe en `max` bytes; `null` si es más grande (deja de leer en cuanto se pasa). */
  fun leerHasta(entrada: InputStream, max: Int = MAX_BYTES): ByteArray? {
    val salida = java.io.ByteArrayOutputStream()
    val bufer = ByteArray(64 * 1024)
    var total = 0
    while (true) {
      val n = entrada.read(bufer)
      if (n < 0) break
      total += n
      if (total > max) return null
      salida.write(bufer, 0, n)
    }
    return salida.toByteArray()
  }

  /** Abre el PDF y extrae el texto de cada página. `bytes == null` significa "más grande que el límite". */
  fun extraer(lector: LectorPdf, bytes: ByteArray?, contrasena: String?): ResultadoPdf {
    if (bytes == null) return ResultadoPdf.DemasiadoGrande
    if (bytes.isEmpty()) return ResultadoPdf.Invalido
    val clave = contrasena?.takeIf { it.isNotEmpty() }
    val documento = try {
      lector.abrir(bytes, clave)
    } catch (e: PdfProtegido) {
      return if (clave == null) ResultadoPdf.PideContrasena else ResultadoPdf.ContrasenaIncorrecta
    } catch (e: IOException) {
      return ResultadoPdf.Invalido
    } catch (e: RuntimeException) {
      return ResultadoPdf.Invalido
    }
    return documento.use { d ->
      try {
        // PDFBox repara lo que puede: un archivo cortado puede "abrir" sin páginas.
        if (d.paginas == 0) return@use ResultadoPdf.Invalido
        if (d.paginas > MAX_PAGINAS) return@use ResultadoPdf.DemasiadoGrande
        ResultadoPdf.Texto((1..d.paginas).map { d.texto(it) })
      } catch (e: IOException) {
        ResultadoPdf.Invalido
      } catch (e: RuntimeException) {
        ResultadoPdf.Invalido
      }
    }
  }
}
