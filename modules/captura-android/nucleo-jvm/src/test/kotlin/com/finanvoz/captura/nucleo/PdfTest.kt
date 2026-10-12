package com.finanvoz.captura.nucleo

import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.text.Normalizer
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException
import org.apache.pdfbox.text.PDFTextStripper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Spike de M15 (`07 §8`): Apache PDFBox 2.0.27, la versión que porta PdfBox-Android 2.0.27.0, extrae de los PDF
 * sintéticos de `fixtures/pdf` exactamente el texto de su `.txt` (que es lo que leen los analizadores de
 * `packages/core`). El adaptador replica `EstadoCuentaPdf.kt` con los paquetes de Apache.
 */
class PdfTest {
  private val dir = File(raizRepo(), "fixtures/pdf")

  /** Igual que `EstadoCuentaPdf.kt`, con `org.apache.pdfbox` en lugar de `com.tom_roush.pdfbox`. */
  private val lector = LectorPdf { bytes, contrasena ->
    val doc = try {
      PDDocument.load(bytes, contrasena ?: "")
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

  /** La normalización de `normalizarTextoPdf` (`packages/core`): NFC, espacios simples, sin renglones vacíos. */
  private fun normalizar(paginas: List<String>): String =
    paginas
      .joinToString("\n")
      .let { Normalizer.normalize(it, Normalizer.Form.NFC) }
      .replace(Regex("\r\n?"), "\n")
      .split("\n")
      .map { it.replace(Regex("[\\s\\u00a0]+"), " ").trim() }
      .filter { it.isNotEmpty() }
      .joinToString("\n", postfix = "\n")

  private fun extraer(nombre: String, contrasena: String? = null) =
    ExtraccionPdf.extraer(lector, File(dir, nombre).readBytes(), contrasena)

  private fun texto(r: ResultadoPdf): String = normalizar((r as ResultadoPdf.Texto).paginas)

  @Test
  fun `los tres bancos sinteticos dan exactamente su texto esperado`() {
    for (banco in listOf("banco_b", "banco_e", "banco_f")) {
      val r = extraer("$banco.pdf")
      assertTrue("$banco: $r", r is ResultadoPdf.Texto)
      assertEquals(banco, File(dir, "$banco.txt").readText(), texto(r))
    }
  }

  @Test
  fun `banco B tiene dos paginas`() {
    assertEquals(2, (extraer("banco_b.pdf") as ResultadoPdf.Texto).paginas.size)
  }

  @Test
  fun `un PDF con contrasena la pide, rechaza una incorrecta y abre con la correcta`() {
    assertEquals(ResultadoPdf.PideContrasena, extraer("banco_e.protegido.pdf"))
    assertEquals(ResultadoPdf.PideContrasena, extraer("banco_e.protegido.pdf", ""))
    assertEquals(ResultadoPdf.ContrasenaIncorrecta, extraer("banco_e.protegido.pdf", "otra"))
    val r = extraer("banco_e.protegido.pdf", "PRUEBA2026")
    assertEquals(File(dir, "banco_e.txt").readText(), texto(r))
  }

  @Test
  fun `un PDF escaneado no tiene texto`() {
    val r = extraer("escaneado.pdf") as ResultadoPdf.Texto
    assertEquals(1, r.paginas.size)
    assertEquals("", r.paginas.joinToString("").trim())
  }

  @Test
  fun `algo que no es PDF es invalido y vacio tambien`() {
    assertEquals(ResultadoPdf.Invalido, ExtraccionPdf.extraer(lector, "hola".toByteArray(), null))
    assertEquals(ResultadoPdf.Invalido, ExtraccionPdf.extraer(lector, ByteArray(0), null))
    val cortado = File(dir, "banco_f.pdf").readBytes().copyOf(200)
    assertEquals(ResultadoPdf.Invalido, ExtraccionPdf.extraer(lector, cortado, null))
  }

  @Test
  fun `mas grande que el limite no se lee`() {
    assertEquals(ResultadoPdf.DemasiadoGrande, ExtraccionPdf.extraer(lector, null, null))
    assertNull(ExtraccionPdf.leerHasta(ByteArrayInputStream(ByteArray(11)), 10))
    assertEquals(10, ExtraccionPdf.leerHasta(ByteArrayInputStream(ByteArray(10)), 10)?.size)
  }

  @Test
  fun `mas paginas que el limite es demasiado grande y siempre cierra el documento`() {
    var cerrado = false
    val largo = LectorPdf { _, _ ->
      object : DocumentoPdf {
        override val paginas = ExtraccionPdf.MAX_PAGINAS + 1
        override fun texto(numero: Int) = ""
        override fun close() {
          cerrado = true
        }
      }
    }
    assertEquals(ResultadoPdf.DemasiadoGrande, ExtraccionPdf.extraer(largo, ByteArray(1), null))
    assertTrue(cerrado)
  }

  @Test
  fun `un error al extraer una pagina es invalido`() {
    val roto = LectorPdf { _, _ ->
      object : DocumentoPdf {
        override val paginas = 1
        override fun texto(numero: Int): String = throw IOException("x")
        override fun close() {}
      }
    }
    assertEquals(ResultadoPdf.Invalido, ExtraccionPdf.extraer(roto, ByteArray(1), null))
  }

  @Test
  fun `el resultado para JS no trae nada mas que el texto`() {
    assertEquals(mapOf("resultado" to "texto", "paginas" to listOf("a")), ResultadoPdf.Texto(listOf("a")).aMapa())
    assertEquals(mapOf("resultado" to "pide_contrasena"), ResultadoPdf.PideContrasena.aMapa())
    assertEquals(mapOf("resultado" to "contrasena_incorrecta"), ResultadoPdf.ContrasenaIncorrecta.aMapa())
    assertEquals(mapOf("resultado" to "invalido"), ResultadoPdf.Invalido.aMapa())
    assertEquals(mapOf("resultado" to "demasiado_grande"), ResultadoPdf.DemasiadoGrande.aMapa())
  }
}
