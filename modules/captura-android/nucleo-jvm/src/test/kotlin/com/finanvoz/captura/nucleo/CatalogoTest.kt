package com.finanvoz.captura.nucleo

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogoTest {
  private val principal = File(raizModulo(), "android/src/main/assets/captura.bancos.json")
  private val depuracion = File(raizModulo(), "android/src/debug/assets/captura.bancos.depuracion.json")

  @Test
  fun `el catalogo embebido es valido y no trae bancos sinteticos`() {
    val c = Catalogo.deJson(principal.readText())
    assertTrue(c.bancos.size >= 6)
    assertEquals("sin paquetes repetidos", c.bancos.sumOf { it.paquetes.size }, c.paquetes.size)
    assertTrue(c.paquetes.none { it.startsWith("mx.ejemplo.") })
    assertTrue(PAQUETE_SHELL !in c.paquetes)
  }

  @Test
  fun `el catalogo de depuracion coincide con los bancos de fixtures`() {
    val c = Catalogo.deJson(depuracion.readText())
    val fixtures = Catalogo.deJson(File(raizRepo(), "fixtures/notificaciones/plantillas.ejemplo.json").readText())
    assertEquals(fixtures.bancos.map { it.id to it.paquetes }, c.bancos.map { it.id to it.paquetes })
    assertEquals(
      mapOf(
        "banco_a" to "mx.ejemplo.bancoa",
        "banco_b" to "mx.ejemplo.bancob",
        "billetera_c" to "mx.ejemplo.billeterac",
        "cobros_d" to "mx.ejemplo.cobrosd",
      ),
      Filtro.mapeoDesde(c),
    )
  }

  @Test
  fun `los ejemplos de fixtures vienen de paquetes del catalogo de depuracion`() {
    val c = Catalogo.deJson(depuracion.readText())
    val lineas = listOf("ejemplos.jsonl", "negocio.ejemplos.jsonl").flatMap {
      File(raizRepo(), "fixtures/notificaciones/$it").readLines().filter(String::isNotBlank)
    }
    assertEquals(14, lineas.size)
    for (l in lineas) {
      val paquete = (Json.leer(l) as Map<*, *>)["paquete"] as String
      assertTrue(paquete, c.bancoDe(paquete) != null)
    }
  }

  @Test
  fun `valida nombres de paquete`() {
    assertTrue(Catalogo.esPaqueteValido("com.nu.production"))
    assertTrue(!Catalogo.esPaqueteValido("sinpunto"))
    assertTrue(!Catalogo.esPaqueteValido("com..doble"))
    assertTrue(!Catalogo.esPaqueteValido("com.1numero"))
  }

  @Test(expected = Json.ErrorJson::class)
  fun `un catalogo invalido es un error`() {
    Catalogo.deJson("{\"bancos\":[{\"id\":\"x\",\"nombre\":\"X\",\"paquetes_android\":[]}]}")
  }

  @Test
  fun `la lista blanca efectiva es lo marcado dentro del catalogo`() {
    val f = Filtro(setOf("mx.ejemplo.bancoa", "com.whatsapp"), CATALOGO_PRUEBA)
    assertEquals(setOf("mx.ejemplo.bancoa"), f.efectivos)
  }
}
