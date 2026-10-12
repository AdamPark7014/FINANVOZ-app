package com.finanvoz.captura.nucleo

import java.io.File
import java.nio.file.Files

/**
 * Notificación de prueba que anota cada campo que se lee. Sirve para demostrar que, ante una
 * app no autorizada, el código no toca nada más que el paquete (regla 10).
 */
class FuenteEspia(
  override val paquete: String,
  private val etiqueta: String? = null,
  private val clave: String = "0|$paquete|1|null|10123",
  private val publicadaEn: Long = 1_760_198_400_000,
  private val cuando: Long = 1_760_198_400_000,
  private val resumenGrupo: Boolean = false,
  private val enCurso: Boolean = false,
  private val titulo: CharSequence? = "Compra con tu tarjeta",
  private val textoGrande: CharSequence? = null,
  private val texto: CharSequence? = "Compraste \$250.00 en OXXO PUEBLA 123 con tu tarjeta ***5521.",
  private val extras: Set<String> = setOf("android.title", "android.text"),
) : FuenteNotificacion {
  val leidos = mutableListOf<String>()

  override fun etiqueta(): String? = etiqueta.also { leidos += "etiqueta" }
  override fun clave(): String = clave.also { leidos += "clave" }
  override fun publicadaEn(): Long = publicadaEn.also { leidos += "publicadaEn" }
  override fun cuandoBruto(): Long = cuando.also { leidos += "cuando" }
  override fun esResumenDeGrupo(): Boolean = resumenGrupo.also { leidos += "resumenGrupo" }
  override fun enCurso(): Boolean = enCurso.also { leidos += "enCurso" }
  override fun titulo(): CharSequence? = titulo.also { leidos += "titulo" }
  override fun textoGrande(): CharSequence? = textoGrande.also { leidos += "textoGrande" }
  override fun texto(): CharSequence? = texto.also { leidos += "texto" }
  override fun nombresDeExtras(): Set<String> = extras.also { leidos += "extras" }
}

/** Almacén en memoria que cuenta escrituras. */
class AlmacenMemoria : AlmacenLineas {
  val lineas = mutableListOf<String>()
  var escrituras = 0

  override fun leerLineas(): List<String> = lineas.toList()
  override fun agregarLinea(linea: String) {
    escrituras++
    lineas += linea
  }
  override fun reescribir(lineas: List<String>) {
    escrituras++
    this.lineas.clear()
    this.lineas += lineas
  }
}

class TextoMemoria : AlmacenTexto {
  var texto: String? = null
  var escrituras = 0
  override fun leer(): String? = texto
  override fun escribir(texto: String) {
    escrituras++
    this.texto = texto
  }
  override fun borrar() {
    texto = null
  }
}

val CATALOGO_PRUEBA = Catalogo(
  listOf(
    Banco("banco_a", "Banco A", listOf("mx.ejemplo.bancoa")),
    Banco("banco_b", "Banco B", listOf("mx.ejemplo.bancob")),
    Banco("billetera_c", "Billetera C", listOf("mx.ejemplo.billeterac")),
  ),
)

fun directorioTemporal(): File = Files.createTempDirectory("captura").toFile().also { it.deleteOnExit() }

fun raizModulo(): File = File(System.getProperty("captura.modulo") ?: error("falta captura.modulo"))

fun raizRepo(): File = File(System.getProperty("captura.repo") ?: error("falta captura.repo"))
