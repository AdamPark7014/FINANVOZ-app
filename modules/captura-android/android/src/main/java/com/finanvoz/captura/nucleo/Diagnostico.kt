package com.finanvoz.captura.nucleo

import java.io.File
import java.io.FileOutputStream

/** Un archivo de texto completo (el resumen de diagnóstico). */
interface AlmacenTexto {
  fun leer(): String?
  fun escribir(texto: String)
  fun borrar()
}

class ArchivoTexto(private val archivo: File) : AlmacenTexto {
  override fun leer(): String? = if (archivo.exists()) archivo.readText(Charsets.UTF_8) else null

  override fun escribir(texto: String) {
    archivo.parentFile?.mkdirs()
    val tmp = File(archivo.parentFile, archivo.name + ".tmp")
    FileOutputStream(tmp, false).use { it.write(texto.toByteArray(Charsets.UTF_8)); it.fd.sync() }
    if (!tmp.renameTo(archivo)) {
      archivo.delete()
      tmp.renameTo(archivo)
    }
  }

  override fun borrar() {
    archivo.delete()
  }
}

/** Qué pasó con una notificación de una app autorizada. */
enum class Resultado(val clave: String) {
  ENCOLADA("encoladas"),
  REPETIDA("repetidas"),
  RESUMEN_GRUPO("resumen_grupo"),
  EN_CURSO("en_curso"),
}

/**
 * Modo diagnóstico del spike S2 (`07 §4`, `09 §M5`).
 *
 * El resumen guarda **solo** nombres de paquete autorizados y conteos de estructura: cuántas
 * notificaciones, cuántas traen título, texto grande o texto, en qué rango de largo cae el
 * texto y qué extras `android.*` usan. Nunca texto, montos ni comercios.
 *
 * De las apps no autorizadas solo se cuenta el total, sin paquete (regla 10: no se persiste
 * nada de ellas).
 *
 * Las **muestras** (título y texto de apps autorizadas, para anonimizarlas a mano y escribir
 * plantillas reales) existen solo si el build lo permite (`permiteMuestras`, únicamente en
 * depuración) y el usuario las activó explícitamente.
 */
class Diagnostico(
  private val resumenAlmacen: AlmacenTexto,
  private val muestrasAlmacen: AlmacenLineas,
  val permiteMuestras: Boolean,
) {
  private val candado = Any()

  val activo: Boolean get() = synchronized(candado) { estado()["activo"] == true }

  val muestrasActivas: Boolean
    get() = synchronized(candado) { permiteMuestras && estado()["activo"] == true && estado()["muestras"] == true }

  /** Activa o desactiva. Pedir muestras en un build que no las permite es un error. */
  fun configurar(activo: Boolean, muestras: Boolean, ahora: Long) = synchronized(candado) {
    require(!muestras || permiteMuestras) { "las muestras solo existen en builds de depuración" }
    val e = estado().toMutableMap()
    if (activo && e["activo"] != true) e["desde"] = ahora
    e["activo"] = activo
    e["muestras"] = activo && muestras
    guardar(e)
  }

  fun registrarNoAutorizada() = synchronized(candado) {
    val e = estado()
    if (e["activo"] != true) return
    val m = e.toMutableMap()
    m["no_autorizadas"] = ((e["no_autorizadas"] as? Long) ?: 0L) + 1
    guardar(m)
  }

  fun registrar(paquete: String, f: FuenteNotificacion, resultado: Resultado, n: NotificacionCruda?) =
    synchronized(candado) {
      val e = estado()
      if (e["activo"] != true) return
      val m = e.toMutableMap()
      val paquetes = ((e["paquetes"] as? Map<*, *>) ?: emptyMap<String, Any?>()).toMutableMap()
      val p = ((paquetes[paquete] as? Map<*, *>) ?: emptyMap<String, Any?>()).toMutableMap()
      fun sumar(destino: MutableMap<Any?, Any?>, clave: String) {
        destino[clave] = ((destino[clave] as? Long) ?: 0L) + 1
      }
      sumar(p, "recibidas")
      sumar(p, resultado.clave)
      if (!f.titulo().isNullOrEmpty()) sumar(p, "con_titulo")
      if (!f.textoGrande().isNullOrEmpty()) sumar(p, "con_texto_grande")
      if (!f.texto().isNullOrEmpty()) sumar(p, "con_texto")
      if (n != null) {
        if (n.titulo.isEmpty() && n.texto.isEmpty()) sumar(p, "sin_contenido")
        val largos = ((p["largo_texto"] as? Map<*, *>) ?: emptyMap<String, Any?>()).toMutableMap()
        sumar(largos, rangoDeLargo(n.texto.length))
        p["largo_texto"] = largos
      }
      val extras = ((p["extras"] as? Map<*, *>) ?: emptyMap<String, Any?>()).toMutableMap()
      for (nombre in f.nombresDeExtras()) if (nombre.startsWith("android.")) sumar(extras, nombre)
      p["extras"] = extras
      paquetes[paquete] = p
      m["paquetes"] = paquetes
      guardar(m)
      if (n != null && resultado == Resultado.ENCOLADA && permiteMuestras && e["muestras"] == true) {
        if (muestrasAlmacen.leerLineas().size < MAX_MUESTRAS) {
          muestrasAlmacen.agregarLinea(
            Json.escribir(
              linkedMapOf(
                "paquete" to n.paquete,
                "etiqueta" to n.etiqueta,
                "titulo" to n.titulo,
                "texto" to n.texto,
                "cuando" to n.cuando,
              ),
            ),
          )
        }
      }
    }

  /** Resumen para mostrar o exportar: configuración y conteos, sin texto. */
  fun resumen(): Map<String, Any?> = synchronized(candado) {
    val e = estado()
    linkedMapOf(
      "activo" to (e["activo"] == true),
      "muestras" to (permiteMuestras && e["muestras"] == true),
      "permite_muestras" to permiteMuestras,
      "desde" to e["desde"],
      "no_autorizadas" to ((e["no_autorizadas"] as? Long) ?: 0L),
      "paquetes" to ((e["paquetes"] as? Map<*, *>) ?: emptyMap<String, Any?>()),
    )
  }

  /** Muestras capturadas (vacío si el build no las permite). */
  fun muestras(): List<Map<*, *>> = synchronized(candado) {
    if (!permiteMuestras) return emptyList()
    muestrasAlmacen.leerLineas().mapNotNull {
      try {
        Json.leer(it) as? Map<*, *>
      } catch (e: Json.ErrorJson) {
        null
      }
    }
  }

  /** Borra conteos y muestras; conserva si está activo. */
  fun borrarDatos(ahora: Long) = synchronized(candado) {
    val e = estado()
    muestrasAlmacen.reescribir(emptyList())
    guardar(
      linkedMapOf(
        "activo" to (e["activo"] == true),
        "muestras" to (e["muestras"] == true),
        "desde" to if (e["activo"] == true) ahora else null,
      ),
    )
  }

  private fun estado(): Map<*, *> {
    val t = resumenAlmacen.leer() ?: return emptyMap<String, Any?>()
    return try {
      Json.leer(t) as? Map<*, *> ?: emptyMap<String, Any?>()
    } catch (e: Json.ErrorJson) {
      emptyMap<String, Any?>()
    }
  }

  private fun guardar(m: Map<*, *>) = resumenAlmacen.escribir(Json.escribir(m))

  companion object {
    const val MAX_MUESTRAS = 500

    fun rangoDeLargo(n: Int): String = when {
      n == 0 -> "0"
      n <= 80 -> "1-80"
      n <= 160 -> "81-160"
      n <= 320 -> "161-320"
      else -> "321+"
    }
  }
}
