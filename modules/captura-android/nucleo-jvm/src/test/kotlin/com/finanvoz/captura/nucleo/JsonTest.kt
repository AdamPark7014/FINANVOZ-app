package com.finanvoz.captura.nucleo

import org.junit.Assert.assertEquals
import org.junit.Test

class JsonTest {
  @Test
  fun `ida y vuelta`() {
    val v = linkedMapOf(
      "texto" to "a\"b\\c\n\u0001ñ💳 ",
      "entero" to 1_760_198_400_000L,
      "decimal" to 1.5,
      "si" to true,
      "no" to false,
      "nada" to null,
      "lista" to listOf(1L, "x", listOf<Any?>(), emptyMap<String, Any?>()),
    )
    assertEquals(v, Json.leer(Json.escribir(v)))
  }

  @Test
  fun `lee escapes unicode y espacios`() {
    assertEquals(mapOf("a" to "é/"), Json.leer(" { \"a\" : \"\\u00e9\\/\" } "))
    assertEquals(-12L, Json.leer("-12"))
    assertEquals(1.0e3, Json.leer("1e3"))
  }

  @Test
  fun `rechaza json invalido`() {
    for (malo in listOf("", "{", "{\"a\":}", "[1,]", "\"sin cerrar", "tru", "1 2", "{\"a\":1,}", "-", "\"\u0001\"")) {
      try {
        Json.leer(malo)
        throw AssertionError("aceptó: $malo")
      } catch (e: Json.ErrorJson) {
        // esperado
      }
    }
  }
}
