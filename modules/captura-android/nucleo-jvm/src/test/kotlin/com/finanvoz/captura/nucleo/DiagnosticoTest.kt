package com.finanvoz.captura.nucleo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DiagnosticoTest {
  private val titulo = "Compra con tu tarjeta"
  private val texto = "Compraste \$1,830.00 en SORIANA SUC 23 con tu tarjeta ***8812."

  private fun fuente() = FuenteEspia(
    paquete = "mx.ejemplo.bancob",
    titulo = titulo,
    textoGrande = texto,
    texto = "Compraste…",
    extras = setOf("android.title", "android.bigText", "android.text", "com.banco.privado"),
  )

  @Test
  fun `apagado no escribe nada`() {
    val r = TextoMemoria()
    val m = AlmacenMemoria()
    val d = Diagnostico(r, m, permiteMuestras = true)
    d.registrarNoAutorizada()
    d.registrar("mx.ejemplo.bancob", fuente(), Resultado.ENCOLADA, Extractor.extraer(fuente(), "mx.ejemplo.bancob"))
    assertEquals(0, r.escrituras)
    assertEquals(0, m.escrituras)
  }

  @Test
  fun `el resumen solo tiene paquetes autorizados y conteos, nunca texto`() {
    val r = TextoMemoria()
    val m = AlmacenMemoria()
    val d = Diagnostico(r, m, permiteMuestras = false)
    d.configurar(activo = true, muestras = false, ahora = 5)
    val n = Extractor.extraer(fuente(), "mx.ejemplo.bancob")
    d.registrar("mx.ejemplo.bancob", fuente(), Resultado.ENCOLADA, n)
    d.registrar("mx.ejemplo.bancob", fuente(), Resultado.RESUMEN_GRUPO, null)

    val guardado = r.texto!!
    for (prohibido in listOf("Compra", "1,830", "1830", "SORIANA", "8812", "com.banco.privado")) {
      assertFalse("no guarda '$prohibido'", guardado.contains(prohibido))
    }
    val p = (d.resumen()["paquetes"] as Map<*, *>)["mx.ejemplo.bancob"] as Map<*, *>
    assertEquals(2L, p["recibidas"])
    assertEquals(1L, p["encoladas"])
    assertEquals(1L, p["resumen_grupo"])
    assertEquals(2L, p["con_texto_grande"])
    assertEquals(mapOf("1-80" to 1L), p["largo_texto"])
    assertEquals(2L, (p["extras"] as Map<*, *>)["android.bigText"])
    assertEquals(0, m.escrituras)
    assertEquals(5L, d.resumen()["desde"])
  }

  @Test(expected = IllegalArgumentException::class)
  fun `fuera de depuracion no se pueden activar muestras`() {
    Diagnostico(TextoMemoria(), AlmacenMemoria(), permiteMuestras = false).configurar(activo = true, muestras = true, ahora = 0)
  }

  @Test
  fun `en depuracion con muestras activadas guarda titulo y texto de apps autorizadas`() {
    val m = AlmacenMemoria()
    val d = Diagnostico(TextoMemoria(), m, permiteMuestras = true)
    d.configurar(activo = true, muestras = true, ahora = 0)
    val n = Extractor.extraer(fuente(), "mx.ejemplo.bancob")
    d.registrar("mx.ejemplo.bancob", fuente(), Resultado.ENCOLADA, n)
    d.registrar("mx.ejemplo.bancob", fuente(), Resultado.REPETIDA, n)
    assertEquals(1, d.muestras().size)
    assertEquals(texto, d.muestras()[0]["texto"])
    assertTrue(d.muestrasActivas)

    d.borrarDatos(ahora = 9)
    assertTrue(d.muestras().isEmpty())
    assertEquals(emptyMap<String, Any?>(), d.resumen()["paquetes"])
    assertTrue(d.activo)

    d.configurar(activo = false, muestras = true, ahora = 10)
    assertFalse(d.muestrasActivas)
  }

  @Test
  fun `rangos de largo`() {
    assertEquals("0", Diagnostico.rangoDeLargo(0))
    assertEquals("1-80", Diagnostico.rangoDeLargo(80))
    assertEquals("81-160", Diagnostico.rangoDeLargo(81))
    assertEquals("161-320", Diagnostico.rangoDeLargo(320))
    assertEquals("321+", Diagnostico.rangoDeLargo(321))
  }
}
