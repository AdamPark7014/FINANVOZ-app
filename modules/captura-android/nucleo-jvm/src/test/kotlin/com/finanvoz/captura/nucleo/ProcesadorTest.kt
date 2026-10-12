package com.finanvoz.captura.nucleo

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * CA-M5-02 a nivel de lógica: una notificación de una app no autorizada no aparece en la cola
 * ni se persiste, y el código no lee nada de ella salvo el paquete.
 */
class ProcesadorTest {
  private class Entorno(
    autorizados: Set<String>,
    mapeo: Map<String, String>? = null,
    diagnosticoActivo: Boolean = true,
  ) {
    val dir: File = directorioTemporal()
    val archivoCola = File(dir, "captura/cola.jsonl")
    val archivoDiagnostico = File(dir, "captura/diagnostico.json")
    val archivoMuestras = File(dir, "captura/muestras.jsonl")
    val cola = Cola(AlmacenArchivo(archivoCola))
    val diagnostico = Diagnostico(ArchivoTexto(archivoDiagnostico), AlmacenArchivo(archivoMuestras), permiteMuestras = true)
    var vistas = 0
    val procesador: Procesador

    init {
      if (diagnosticoActivo) diagnostico.configurar(activo = true, muestras = true, ahora = 1L)
      procesador = Procesador(Filtro(autorizados, CATALOGO_PRUEBA, mapeo), cola, diagnostico) { vistas++ }
    }

    fun archivosConContenido(): List<File> = dir.walkTopDown().filter { it.isFile && it.length() > 0 }.toList()
  }

  @Test
  fun `CA-M5-02 app no autorizada no se lee ni se encola ni se escribe`() {
    val e = Entorno(autorizados = setOf("mx.ejemplo.bancoa"), diagnosticoActivo = false)
    val intrusa = FuenteEspia(paquete = "com.whatsapp", titulo = "Mamá", texto = "Te deposité \$500")

    assertNull(e.procesador.procesar(intrusa))

    assertEquals("no se lee ningún campo además del paquete", emptyList<String>(), intrusa.leidos)
    assertTrue(e.cola.leer().isEmpty())
    assertFalse("la cola ni siquiera se crea", e.archivoCola.exists())
    assertTrue("no se escribe ningún archivo", e.archivosConContenido().isEmpty())
    assertEquals(0, e.vistas)
  }

  @Test
  fun `CA-M5-02 con diagnostico activo solo sube un contador anonimo`() {
    val e = Entorno(autorizados = setOf("mx.ejemplo.bancoa"))
    val antes = e.archivoDiagnostico.readText()
    val intrusa = FuenteEspia(paquete = "com.whatsapp", titulo = "Mamá", texto = "Te deposité \$500")

    assertNull(e.procesador.procesar(intrusa))

    assertEquals(emptyList<String>(), intrusa.leidos)
    assertFalse(e.archivoCola.exists())
    assertFalse(e.archivoMuestras.exists())
    val despues = e.archivoDiagnostico.readText()
    assertTrue(antes != despues)
    for (prohibido in listOf("com.whatsapp", "Mamá", "500", "deposit")) {
      assertFalse("el diagnóstico no guarda '$prohibido'", despues.contains(prohibido))
    }
    assertEquals(1L, e.diagnostico.resumen()["no_autorizadas"])
  }

  @Test
  fun `paquete marcado por el usuario pero fuera del catalogo no se lee`() {
    val e = Entorno(autorizados = setOf("mx.ejemplo.bancoa", "com.whatsapp"), diagnosticoActivo = false)
    val intrusa = FuenteEspia(paquete = "com.whatsapp")
    assertNull(e.procesador.procesar(intrusa))
    assertEquals(emptyList<String>(), intrusa.leidos)
    assertFalse(e.archivoCola.exists())
  }

  @Test
  fun `banco del catalogo que el usuario no marco no se lee`() {
    val e = Entorno(autorizados = setOf("mx.ejemplo.bancoa"), diagnosticoActivo = false)
    val otro = FuenteEspia(paquete = "mx.ejemplo.bancob")
    assertNull(e.procesador.procesar(otro))
    assertEquals(emptyList<String>(), otro.leidos)
    assertFalse(e.archivoCola.exists())
  }

  @Test
  fun `app autorizada se extrae y se encola`() {
    val e = Entorno(autorizados = setOf("mx.ejemplo.bancoa"))
    val n = e.procesador.procesar(FuenteEspia(paquete = "mx.ejemplo.bancoa", etiqueta = null))
    assertNotNull(n)
    assertEquals(listOf(n), e.cola.leer())
    assertEquals(1, e.vistas)
    assertEquals(1, e.diagnostico.muestras().size)
  }

  @Test
  fun `resumen de grupo y notificaciones en curso se ignoran pero prueban que el servicio vive`() {
    val e = Entorno(autorizados = setOf("mx.ejemplo.bancoa"))
    assertNull(e.procesador.procesar(FuenteEspia(paquete = "mx.ejemplo.bancoa", resumenGrupo = true)))
    assertNull(e.procesador.procesar(FuenteEspia(paquete = "mx.ejemplo.bancoa", enCurso = true)))
    assertTrue(e.cola.leer().isEmpty())
    assertEquals(2, e.vistas)
  }

  @Test
  fun `la misma notificacion releida al reconectar no se encola dos veces`() {
    val e = Entorno(autorizados = setOf("mx.ejemplo.bancoa"))
    assertNotNull(e.procesador.procesar(FuenteEspia(paquete = "mx.ejemplo.bancoa")))
    assertNull(e.procesador.procesar(FuenteEspia(paquete = "mx.ejemplo.bancoa")))
    assertEquals(1, e.cola.leer().size)
    val paquete = (e.diagnostico.resumen()["paquetes"] as Map<*, *>)["mx.ejemplo.bancoa"] as Map<*, *>
    assertEquals(1L, paquete["repetidas"])
  }

  @Test
  fun `en produccion adb no es un banco aunque traiga la etiqueta`() {
    val e = Entorno(autorizados = setOf("mx.ejemplo.bancoa"), mapeo = null, diagnosticoActivo = false)
    val adb = FuenteEspia(paquete = PAQUETE_SHELL, etiqueta = "banco_a")
    assertNull(e.procesador.procesar(adb))
    assertEquals(emptyList<String>(), adb.leidos)
    assertFalse(e.archivoCola.exists())
  }

  @Test
  fun `en depuracion la etiqueta de adb se trata como el primer paquete del banco`() {
    val mapeo = Filtro.mapeoDesde(CATALOGO_PRUEBA)
    val e = Entorno(autorizados = setOf("mx.ejemplo.bancoa", "mx.ejemplo.bancob"), mapeo = mapeo)
    val n = e.procesador.procesar(FuenteEspia(paquete = PAQUETE_SHELL, etiqueta = "banco_b"))
    assertEquals("mx.ejemplo.bancob", n?.paquete)
    assertEquals("banco_b", n?.etiqueta)
  }

  @Test
  fun `en depuracion adb con etiqueta desconocida o banco no autorizado se descarta`() {
    val mapeo = Filtro.mapeoDesde(CATALOGO_PRUEBA)
    val e = Entorno(autorizados = setOf("mx.ejemplo.bancoa"), mapeo = mapeo, diagnosticoActivo = false)
    val desconocida = FuenteEspia(paquete = PAQUETE_SHELL, etiqueta = "hola")
    val noAutorizado = FuenteEspia(paquete = PAQUETE_SHELL, etiqueta = "billetera_c")
    assertNull(e.procesador.procesar(desconocida))
    assertNull(e.procesador.procesar(noAutorizado))
    assertEquals(listOf("etiqueta"), desconocida.leidos)
    assertEquals(listOf("etiqueta"), noAutorizado.leidos)
    assertFalse(e.archivoCola.exists())
  }
}
