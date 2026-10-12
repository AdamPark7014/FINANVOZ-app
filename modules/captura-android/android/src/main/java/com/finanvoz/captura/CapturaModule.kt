package com.finanvoz.captura

import android.content.Context
import android.os.Bundle
import com.finanvoz.captura.nucleo.Json
import com.finanvoz.captura.nucleo.NotificacionCruda
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

private const val EVENTO = "notificacion"

/** Una entrada de la cola tal como la devuelve JS para confirmarla. */
class NotificacionRegistro : Record {
  @Field val clave: String = ""
  @Field val etiqueta: String? = null
  @Field val paquete: String = ""
  @Field val titulo: String = ""
  @Field val texto: String = ""
  @Field("publicada_en") val publicadaEn: Double = Double.NaN
  @Field val cuando: Double = Double.NaN

  fun aNotificacion(): NotificacionCruda? = NotificacionCruda.deMapa(
    mapOf(
      "clave" to clave,
      "etiqueta" to etiqueta,
      "paquete" to paquete,
      "titulo" to titulo,
      "texto" to texto,
      "publicada_en" to publicadaEn,
      "cuando" to cuando,
    ),
  )
}

class MuestrasNoPermitidas :
  CodedException("ERR_CAPTURA_MUESTRAS", "Las muestras del modo diagnóstico solo existen en builds de depuración", null)

class CatalogoRemotoInvalido :
  CodedException("ERR_CAPTURA_CATALOGO_REMOTO", "El catálogo de bancos remoto no es válido", null)

/**
 * Módulo `CapturaAndroid` (`07 §2.3`). El puente tipado está en
 * `apps/movil/src/captura/puente.ts`.
 */
class CapturaModule : Module() {
  private val contexto: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("CapturaAndroid")

    Constant("depuracion") { Variante.DEPURACION }

    Events(EVENTO)

    OnStartObserving(EVENTO) {
      Captura.oyente = { n -> sendEvent(EVENTO, n.aBundle()) }
    }

    OnStopObserving(EVENTO) {
      Captura.oyente = null
    }

    OnDestroy {
      Captura.oyente = null
    }

    AsyncFunction("leerCola") {
      Captura.cola(contexto).leer().map { it.aMapa() }
    }

    AsyncFunction("confirmarProcesadas") { procesadas: List<NotificacionRegistro> ->
      Captura.cola(contexto).confirmar(procesadas.mapNotNull { it.aNotificacion() })
    }

    AsyncFunction("estadoPermiso") {
      if (Captura.permisoConcedido(contexto)) "concedido" else "denegado"
    }

    AsyncFunction("abrirAjustesPermiso") {
      Captura.abrirAjustesPermiso(contexto, appContext.currentActivity)
    }

    AsyncFunction("abrirInfoApp") {
      Captura.abrirInfoApp(contexto, appContext.currentActivity)
    }

    AsyncFunction("appsBancariasInstaladas") {
      Captura.appsInstaladas(contexto).map { (banco, paquete) ->
        mapOf("banco" to banco.id, "nombre" to banco.nombre, "paquete" to paquete)
      }
    }

    AsyncFunction("fijarListaBlanca") { paquetes: List<String> ->
      Captura.fijarListaBlanca(contexto, paquetes).sorted()
    }

    AsyncFunction("listaBlanca") {
      Captura.listaBlanca(contexto).sorted()
    }

    AsyncFunction("ultimoEvento") {
      Captura.ultimoEvento(contexto)?.toDouble()
    }

    AsyncFunction("estadoServicio") {
      Captura.estadoServicio(contexto).mapValues { (it.value as Long?)?.toDouble() }
    }

    AsyncFunction("solicitarReconexion") {
      Captura.solicitarReconexion(contexto)
    }

    AsyncFunction("fijarCatalogoRemoto") { json: String? ->
      try {
        Captura.fijarCatalogoRemoto(contexto, json)
      } catch (e: Json.ErrorJson) {
        throw CatalogoRemotoInvalido()
      }
    }

    AsyncFunction("diagnosticoResumen") {
      Captura.diagnostico(contexto).resumen()
    }

    AsyncFunction("diagnosticoConfigurar") { activo: Boolean, muestras: Boolean ->
      val d = Captura.diagnostico(contexto)
      if (muestras && !d.permiteMuestras) throw MuestrasNoPermitidas()
      d.configurar(activo, muestras, System.currentTimeMillis())
      d.resumen()
    }

    AsyncFunction("diagnosticoMuestras") {
      Captura.diagnostico(contexto).muestras()
    }

    AsyncFunction("diagnosticoBorrar") {
      Captura.diagnostico(contexto).borrarDatos(System.currentTimeMillis())
    }

    // M15 (`07 §8`): texto de un estado de cuenta en PDF, leído en el teléfono. La contraseña no se guarda.
    AsyncFunction("extraerTextoPdf") { uri: String, contrasena: String? ->
      EstadoCuentaPdf.extraer(contexto, uri, contrasena).aMapa()
    }
  }
}

private fun NotificacionCruda.aBundle(): Bundle = Bundle().apply {
  putString("clave", clave)
  putString("etiqueta", etiqueta)
  putString("paquete", paquete)
  putString("titulo", titulo)
  putString("texto", texto)
  putDouble("publicada_en", publicadaEn.toDouble())
  putDouble("cuando", cuando.toDouble())
}
