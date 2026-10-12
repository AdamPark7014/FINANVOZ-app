package com.finanvoz.captura

import android.content.Context
import android.net.Uri
import com.finanvoz.captura.nucleo.DocumentoPdf
import com.finanvoz.captura.nucleo.ExtraccionPdf
import com.finanvoz.captura.nucleo.LectorPdf
import com.finanvoz.captura.nucleo.PdfProtegido
import com.finanvoz.captura.nucleo.ResultadoPdf
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException
import com.tom_roush.pdfbox.text.PDFTextStripper

/**
 * Estados de cuenta en PDF (M15, `07 §8`): lee el archivo compartido (`content://` de otra app o `file://` de la
 * caché del selector) y extrae su texto con PdfBox-Android 2.0.27.0, sin red y sin escribir nada en disco
 * (documento solo en memoria). El texto no se registra en ningún log (regla 9).
 */
internal object EstadoCuentaPdf {
  @Volatile private var recursosListos = false

  fun extraer(contexto: Context, uri: String, contrasena: String?): ResultadoPdf {
    if (!recursosListos) {
      // Carga las tablas de glifos y fuentes del AAR (assets); necesario antes de abrir cualquier PDF.
      PDFBoxResourceLoader.init(contexto)
      recursosListos = true
    }
    val bytes = try {
      contexto.contentResolver.openInputStream(Uri.parse(uri))?.use { ExtraccionPdf.leerHasta(it) }
        ?: return ResultadoPdf.Invalido
    } catch (e: Exception) {
      // Sin permiso sobre la URI, archivo inexistente o URI mal formada: para la persona, "no pude abrirlo".
      return ResultadoPdf.Invalido
    }
    return ExtraccionPdf.extraer(lector, bytes, contrasena)
  }

  private val lector = LectorPdf { bytes, contrasena ->
    val doc = try {
      PDDocument.load(bytes, contrasena ?: "", null, null, MemoryUsageSetting.setupMainMemoryOnly())
    } catch (e: InvalidPasswordException) {
      throw PdfProtegido()
    }
    object : DocumentoPdf {
      override val paginas = doc.numberOfPages

      override fun texto(numero: Int): String =
        PDFTextStripper()
          .apply {
            sortByPosition = true
            startPage = numero
            endPage = numero
          }
          .getText(doc)

      override fun close() = doc.close()
    }
  }
}
