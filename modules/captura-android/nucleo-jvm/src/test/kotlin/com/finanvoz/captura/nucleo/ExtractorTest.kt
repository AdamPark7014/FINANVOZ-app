package com.finanvoz.captura.nucleo

import org.junit.Assert.assertEquals
import org.junit.Test

class ExtractorTest {
  @Test
  fun `extrae los siete campos de 03 5_2`() {
    val f = FuenteEspia(
      paquete = "mx.ejemplo.bancoa",
      etiqueta = "banco_a",
      clave = "0|mx.ejemplo.bancoa|7|banco_a|10123",
      publicadaEn = 1_000,
      cuando = 900,
      titulo = "Compra con tu tarjeta",
      textoGrande = "Compraste \$250.00 en OXXO PUEBLA 123 con tu tarjeta ***5521.",
      texto = "Compraste \$250.00…",
    )
    assertEquals(
      NotificacionCruda(
        clave = "0|mx.ejemplo.bancoa|7|banco_a|10123",
        etiqueta = "banco_a",
        paquete = "mx.ejemplo.bancoa",
        titulo = "Compra con tu tarjeta",
        texto = "Compraste \$250.00 en OXXO PUEBLA 123 con tu tarjeta ***5521.",
        publicadaEn = 1_000,
        cuando = 900,
      ),
      Extractor.extraer(f, "mx.ejemplo.bancoa"),
    )
  }

  @Test
  fun `sin texto grande usa el texto`() {
    val n = Extractor.extraer(FuenteEspia(paquete = "p.q", textoGrande = null, texto = "corto"), "p.q")
    assertEquals("corto", n.texto)
    val vacio = Extractor.extraer(FuenteEspia(paquete = "p.q", textoGrande = "", texto = "corto"), "p.q")
    assertEquals("corto", vacio.texto)
  }

  @Test
  fun `sin titulo ni texto quedan vacios y aun se encola para caer en no reconocida`() {
    val n = Extractor.extraer(FuenteEspia(paquete = "p.q", titulo = null, textoGrande = null, texto = null), "p.q")
    assertEquals("", n.titulo)
    assertEquals("", n.texto)
  }

  @Test
  fun `cuando es when si es positivo y si no postTime`() {
    assertEquals(500L, Extractor.extraer(FuenteEspia(paquete = "p.q", publicadaEn = 700, cuando = 500), "p.q").cuando)
    assertEquals(700L, Extractor.extraer(FuenteEspia(paquete = "p.q", publicadaEn = 700, cuando = 0), "p.q").cuando)
    assertEquals(700L, Extractor.extraer(FuenteEspia(paquete = "p.q", publicadaEn = 700, cuando = -1), "p.q").cuando)
  }

  @Test
  fun `recorta textos enormes`() {
    val n = Extractor.extraer(FuenteEspia(paquete = "p.q", texto = "x".repeat(10_000)), "p.q")
    assertEquals(LARGO_MAXIMO, n.texto.length)
  }
}
