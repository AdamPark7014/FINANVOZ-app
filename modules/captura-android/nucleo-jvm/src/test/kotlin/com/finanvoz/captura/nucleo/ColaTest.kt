package com.finanvoz.captura.nucleo

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ColaTest {
  private fun n(clave: String = "k1", cuando: Long = 100, texto: String = "Compraste \$65.00 en CAFE") =
    NotificacionCruda(clave, "banco_a", "mx.ejemplo.bancoa", "Compra", texto, cuando, cuando)

  @Test
  fun `serializa y lee de vuelta con caracteres especiales`() {
    val raro = NotificacionCruda(
      clave = "0|p|1|t\"ag|10",
      etiqueta = null,
      paquete = "mx.ejemplo.bancoa",
      titulo = "¡Aprovecha! \\ \"comillas\"",
      texto = "línea 1\nlínea 2\t fin 💳 ñ",
      publicadaEn = 1_760_198_400_123,
      cuando = 1_760_198_400_000,
    )
    val linea = raro.aLineaJson()
    assertFalse("una entrada ocupa una sola línea", linea.contains('\n') || linea.contains(' '))
    assertEquals(raro, NotificacionCruda.deLineaJson(linea))
    assertEquals(
      listOf("clave", "etiqueta", "paquete", "titulo", "texto", "publicada_en", "cuando"),
      (Json.leer(linea) as Map<*, *>).keys.toList(),
    )
  }

  @Test
  fun `persiste en el archivo y otra instancia la lee en orden`() {
    val archivo = File(directorioTemporal(), "captura/cola.jsonl")
    val cola = Cola(AlmacenArchivo(archivo))
    assertTrue(cola.agregar(n("a", 1)))
    assertTrue(cola.agregar(n("b", 2)))
    assertEquals(listOf("a", "b"), Cola(AlmacenArchivo(archivo)).leer().map { it.clave })
  }

  @Test
  fun `dedupe por identidad completa y conserva dos compras identicas con cuando distinto`() {
    val cola = Cola(AlmacenMemoria())
    assertTrue(cola.agregar(n("k1", 100)))
    assertFalse("misma notificación releída", cola.agregar(n("k1", 100)))
    assertTrue("dos cafés idénticos con 'cuando' distinto", cola.agregar(n("k1", 160)))
    assertTrue("misma clave y cuando pero otro texto (aviso actualizado)", cola.agregar(n("k1", 160, "Otro texto")))
    assertEquals(3, cola.tamano())
  }

  @Test
  fun `confirmar quita solo lo procesado aunque llegue otra con la misma clave`() {
    val cola = Cola(AlmacenMemoria())
    cola.agregar(n("k1", 100))
    cola.agregar(n("k2", 110))
    val leidas = cola.leer()
    cola.agregar(n("k1", 200)) // el banco reutilizó sbn.key para una compra nueva
    assertEquals(2, cola.confirmar(leidas))
    assertEquals(listOf(n("k1", 200)), cola.leer())
    assertEquals(0, cola.confirmar(emptyList()))
  }

  @Test
  fun `omite lineas danadas y recupera una ultima linea sin salto`() {
    val archivo = File(directorioTemporal(), "cola.jsonl")
    archivo.writeText("{\"clave\":\"roto\n" + n("a", 1).aLineaJson() + "\nbasura\n{\"clave\":\"cortada")
    val cola = Cola(AlmacenArchivo(archivo))
    assertEquals(listOf("a"), cola.leer().map { it.clave })
    cola.agregar(n("b", 2))
    assertEquals(listOf("a", "b"), cola.leer().map { it.clave })
    cola.confirmar(listOf(n("a", 1)))
    assertEquals(listOf("b"), cola.leer().map { it.clave })
    assertEquals("las líneas dañadas se limpian al confirmar", 1, archivo.readLines().count { it.isNotBlank() })
  }

  @Test
  fun `rechaza entradas con tipos invalidos`() {
    assertEquals(null, NotificacionCruda.deLineaJson("{\"clave\":1}"))
    assertEquals(null, NotificacionCruda.deLineaJson("[]"))
    val sinCuando = n().aMapa().toMutableMap().apply { remove("cuando") }
    assertEquals(null, NotificacionCruda.deMapa(sinCuando))
    val conDouble = n().aMapa().toMutableMap().apply { put("cuando", 100.0) }
    assertEquals(n(), NotificacionCruda.deMapa(conDouble))
    val conFraccion = n().aMapa().toMutableMap().apply { put("cuando", 100.5) }
    assertEquals(null, NotificacionCruda.deMapa(conFraccion))
  }

  @Test
  fun `vaciar deja la cola en cero`() {
    val cola = Cola(AlmacenMemoria())
    cola.agregar(n())
    cola.vaciar()
    assertEquals(0, cola.tamano())
  }
}
