package com.finanvoz.captura.nucleo

/**
 * JSON mínimo, sin dependencias de Android, para la cola (una línea por notificación), los
 * catálogos de bancos y el resumen de diagnóstico. Valores: Map<String, Any?>, List<Any?>,
 * String, Long, Double, Boolean y null.
 *
 * Se escribe a mano para que el núcleo compile igual en Android y en la JVM de pruebas.
 */
object Json {
  class ErrorJson(mensaje: String) : IllegalArgumentException(mensaje)

  fun escribir(valor: Any?): String = StringBuilder().also { escribirEn(it, valor) }.toString()

  private fun escribirEn(sb: StringBuilder, valor: Any?) {
    when (valor) {
      null -> sb.append("null")
      is String -> escribirTexto(sb, valor)
      is Boolean -> sb.append(if (valor) "true" else "false")
      is Int, is Long, is Short, is Byte -> sb.append(valor.toString())
      is Double -> {
        require(valor.isFinite()) { "número no finito" }
        if (valor == Math.floor(valor) && Math.abs(valor) < 9.0e15) sb.append(valor.toLong()) else sb.append(valor)
      }
      is Map<*, *> -> {
        sb.append('{')
        var primero = true
        for ((k, v) in valor) {
          if (!primero) sb.append(',')
          primero = false
          escribirTexto(sb, k as? String ?: throw ErrorJson("clave no textual"))
          sb.append(':')
          escribirEn(sb, v)
        }
        sb.append('}')
      }
      is Iterable<*> -> {
        sb.append('[')
        var primero = true
        for (v in valor) {
          if (!primero) sb.append(',')
          primero = false
          escribirEn(sb, v)
        }
        sb.append(']')
      }
      else -> throw ErrorJson("tipo no admitido: ${valor.javaClass.simpleName}")
    }
  }

  private fun escribirTexto(sb: StringBuilder, s: String) {
    sb.append('"')
    for (c in s) {
      when (c) {
        '"' -> sb.append("\\\"")
        '\\' -> sb.append("\\\\")
        '\n' -> sb.append("\\n")
        '\r' -> sb.append("\\r")
        '\t' -> sb.append("\\t")
        '\b' -> sb.append("\\b")
        '\u000C' -> sb.append("\\f")
        // U+2028/U+2029 rompen algunos lectores de líneas; se escapan siempre.
        ' ', ' ' -> sb.append(String.format("\\u%04x", c.code))
        else -> if (c < ' ') sb.append(String.format("\\u%04x", c.code)) else sb.append(c)
      }
    }
    sb.append('"')
  }

  fun leer(texto: String): Any? {
    val l = Lector(texto)
    l.espacios()
    val v = l.valor()
    l.espacios()
    if (!l.fin()) throw ErrorJson("contenido después del valor")
    return v
  }

  private class Lector(private val s: String) {
    private var i = 0

    fun fin() = i >= s.length

    fun espacios() {
      while (i < s.length && (s[i] == ' ' || s[i] == '\n' || s[i] == '\r' || s[i] == '\t')) i++
    }

    private fun esperar(c: Char) {
      if (i >= s.length || s[i] != c) throw ErrorJson("se esperaba '$c' en $i")
      i++
    }

    fun valor(): Any? {
      if (i >= s.length) throw ErrorJson("fin inesperado")
      return when (val c = s[i]) {
        '{' -> objeto()
        '[' -> arreglo()
        '"' -> texto()
        't' -> literal("true", true)
        'f' -> literal("false", false)
        'n' -> literal("null", null)
        else -> if (c == '-' || c in '0'..'9') numero() else throw ErrorJson("carácter inesperado en $i")
      }
    }

    private fun literal(palabra: String, v: Any?): Any? {
      if (!s.startsWith(palabra, i)) throw ErrorJson("literal inválido en $i")
      i += palabra.length
      return v
    }

    private fun objeto(): Map<String, Any?> {
      esperar('{')
      val m = LinkedHashMap<String, Any?>()
      espacios()
      if (i < s.length && s[i] == '}') {
        i++
        return m
      }
      while (true) {
        espacios()
        val k = texto()
        espacios()
        esperar(':')
        espacios()
        m[k] = valor()
        espacios()
        if (i < s.length && s[i] == ',') {
          i++
          continue
        }
        esperar('}')
        return m
      }
    }

    private fun arreglo(): List<Any?> {
      esperar('[')
      val a = ArrayList<Any?>()
      espacios()
      if (i < s.length && s[i] == ']') {
        i++
        return a
      }
      while (true) {
        espacios()
        a.add(valor())
        espacios()
        if (i < s.length && s[i] == ',') {
          i++
          continue
        }
        esperar(']')
        return a
      }
    }

    private fun texto(): String {
      esperar('"')
      val sb = StringBuilder()
      while (true) {
        if (i >= s.length) throw ErrorJson("texto sin cerrar")
        val c = s[i++]
        when {
          c == '"' -> return sb.toString()
          c == '\\' -> {
            if (i >= s.length) throw ErrorJson("escape incompleto")
            when (val e = s[i++]) {
              '"' -> sb.append('"')
              '\\' -> sb.append('\\')
              '/' -> sb.append('/')
              'b' -> sb.append('\b')
              'f' -> sb.append('\u000C')
              'n' -> sb.append('\n')
              'r' -> sb.append('\r')
              't' -> sb.append('\t')
              'u' -> {
                if (i + 4 > s.length) throw ErrorJson("escape \\u incompleto")
                val hex = s.substring(i, i + 4)
                sb.append(hex.toIntOrNull(16)?.toChar() ?: throw ErrorJson("escape \\u inválido"))
                i += 4
              }
              else -> throw ErrorJson("escape inválido: $e")
            }
          }
          c < ' ' -> throw ErrorJson("carácter de control sin escapar")
          else -> sb.append(c)
        }
      }
    }

    private fun numero(): Any {
      val inicio = i
      if (s[i] == '-') i++
      while (i < s.length && s[i] in '0'..'9') i++
      var decimal = false
      if (i < s.length && s[i] == '.') {
        decimal = true
        i++
        while (i < s.length && s[i] in '0'..'9') i++
      }
      if (i < s.length && (s[i] == 'e' || s[i] == 'E')) {
        decimal = true
        i++
        if (i < s.length && (s[i] == '+' || s[i] == '-')) i++
        while (i < s.length && s[i] in '0'..'9') i++
      }
      val t = s.substring(inicio, i)
      if (t == "-" || t.isEmpty()) throw ErrorJson("número inválido en $inicio")
      return if (decimal) t.toDoubleOrNull() ?: throw ErrorJson("número inválido")
      else t.toLongOrNull() ?: t.toDoubleOrNull() ?: throw ErrorJson("número inválido")
    }
  }
}
