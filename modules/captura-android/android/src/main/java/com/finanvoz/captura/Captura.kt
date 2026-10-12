package com.finanvoz.captura

import android.app.Activity
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.util.Log
import com.finanvoz.captura.nucleo.AlmacenArchivo
import com.finanvoz.captura.nucleo.ArchivoTexto
import com.finanvoz.captura.nucleo.Banco
import com.finanvoz.captura.nucleo.Catalogo
import com.finanvoz.captura.nucleo.CatalogoRemoto
import com.finanvoz.captura.nucleo.Cola
import com.finanvoz.captura.nucleo.Diagnostico
import com.finanvoz.captura.nucleo.Filtro
import com.finanvoz.captura.nucleo.FuenteNotificacion
import com.finanvoz.captura.nucleo.NotificacionCruda
import com.finanvoz.captura.nucleo.Procesador
import java.io.File

/**
 * Estado compartido del proceso entre el servicio y el módulo de JS: cola, diagnóstico,
 * catálogo, lista blanca y el oyente de JS (si la app está viva).
 *
 * Todo vive en almacenamiento privado excluido de respaldos (`noBackupFilesDir`,
 * `SharedPreferences` privadas). Nada de aquí escribe texto de notificaciones en logs (regla 9).
 */
internal object Captura {
  private const val TAG = "CapturaAndroid"
  private const val PREFERENCIAS = "finanvoz_captura"
  private const val LISTA_BLANCA = "lista_blanca"
  private const val ULTIMO_EVENTO = "ultimo_evento"
  private const val CONECTADO_EN = "conectado_en"
  private const val DESCONECTADO_EN = "desconectado_en"
  private const val ARCHIVO_CATALOGO = "captura.bancos.json"
  private const val ARCHIVO_CATALOGO_DEPURACION = "captura.bancos.depuracion.json"
  private const val ARCHIVO_CATALOGO_REMOTO = "catalogo.remoto.json"

  @Volatile private var cola: Cola? = null
  @Volatile private var diagnostico: Diagnostico? = null
  @Volatile private var catalogos: Pair<Catalogo, Catalogo?>? = null

  /** Oyente de JS; lo pone el módulo mientras haya suscriptores al evento `notificacion`. */
  @Volatile var oyente: ((NotificacionCruda) -> Unit)? = null

  private fun directorio(ctx: Context) = File(ctx.noBackupFilesDir, "captura")

  private fun preferencias(ctx: Context): SharedPreferences =
    ctx.applicationContext.getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE)

  fun cola(ctx: Context): Cola = cola ?: synchronized(this) {
    cola ?: Cola(AlmacenArchivo(File(directorio(ctx), "cola.jsonl"))).also { cola = it }
  }

  fun diagnostico(ctx: Context): Diagnostico = diagnostico ?: synchronized(this) {
    diagnostico ?: Diagnostico(
      ArchivoTexto(File(directorio(ctx), "diagnostico.json")),
      AlmacenArchivo(File(directorio(ctx), "muestras.jsonl")),
      permiteMuestras = Variante.DEPURACION,
    ).also { diagnostico = it }
  }

  private fun catalogoRemoto(ctx: Context) = CatalogoRemoto(ArchivoTexto(File(directorio(ctx), ARCHIVO_CATALOGO_REMOTO)))

  /**
   * Catálogo embebido (con los bancos de las plantillas remotas encima, `07 §3.1`) y, solo en depuración, el de
   * bancos sintéticos para `adb`.
   */
  private fun catalogos(ctx: Context): Pair<Catalogo, Catalogo?> = catalogos ?: synchronized(this) {
    catalogos ?: run {
      val embebido = leerCatalogo(ctx, ARCHIVO_CATALOGO) ?: Catalogo(emptyList())
      val principal = catalogoRemoto(ctx).leer()?.sobre(embebido) ?: embebido
      val depuracion = if (Variante.DEPURACION) leerCatalogo(ctx, ARCHIVO_CATALOGO_DEPURACION) else null
      (principal to depuracion).also { catalogos = it }
    }
  }

  /**
   * Bancos de las plantillas remotas que JS ya verificó (`{bancos}` en JSON; `null` los quita). Un JSON
   * inválido lanza y deja el anterior. Devuelve cuántos bancos remotos quedaron.
   */
  fun fijarCatalogoRemoto(ctx: Context, json: String?): Int = synchronized(this) {
    catalogoRemoto(ctx).fijar(json).also { catalogos = null }
  }

  private fun leerCatalogo(ctx: Context, nombre: String): Catalogo? = try {
    Catalogo.deJson(ctx.assets.open(nombre).bufferedReader(Charsets.UTF_8).use { it.readText() })
  } catch (e: Exception) {
    Log.e(TAG, "Catálogo de bancos ilegible: ${e.javaClass.simpleName}")
    null
  }

  fun catalogo(ctx: Context): Catalogo {
    val (principal, depuracion) = catalogos(ctx)
    return if (depuracion != null) principal + depuracion else principal
  }

  fun listaBlanca(ctx: Context): Set<String> {
    // getStringSet devuelve el conjunto interno: se copia antes de usarlo.
    val guardada = preferencias(ctx).getStringSet(LISTA_BLANCA, null)?.toSet() ?: emptySet()
    val catalogo = catalogo(ctx).paquetes
    return guardada.filter { it in catalogo }.toSet()
  }

  /** Guarda lo marcado por el usuario que esté en el catálogo y devuelve lo que quedó. */
  fun fijarListaBlanca(ctx: Context, paquetes: List<String>): Set<String> {
    val catalogo = catalogo(ctx).paquetes
    val efectiva = paquetes.filter { it in catalogo }.toSet()
    preferencias(ctx).edit().putStringSet(LISTA_BLANCA, HashSet(efectiva)).commit()
    return efectiva
  }

  fun procesar(ctx: Context, fuente: FuenteNotificacion) {
    val (_, depuracion) = catalogos(ctx)
    val filtro = Filtro(listaBlanca(ctx), catalogo(ctx), depuracion?.let { Filtro.mapeoDesde(it) })
    val procesador = Procesador(filtro, cola(ctx), diagnostico(ctx)) { marcar(ctx, ULTIMO_EVENTO) }
    val n = procesador.procesar(fuente) ?: return
    try {
      oyente?.invoke(n)
    } catch (e: Exception) {
      // La cola ya la tiene; JS la leerá al volver.
      Log.w(TAG, "No se pudo avisar a JS: ${e.javaClass.simpleName}")
    }
  }

  private fun marcar(ctx: Context, clave: String) {
    preferencias(ctx).edit().putLong(clave, System.currentTimeMillis()).apply()
  }

  fun registrarConexion(ctx: Context) = marcar(ctx, CONECTADO_EN)

  fun registrarDesconexion(ctx: Context) = marcar(ctx, DESCONECTADO_EN)

  private fun instante(ctx: Context, clave: String): Long? {
    val p = preferencias(ctx)
    return if (p.contains(clave)) p.getLong(clave, 0L) else null
  }

  fun ultimoEvento(ctx: Context): Long? = instante(ctx, ULTIMO_EVENTO)

  fun estadoServicio(ctx: Context): Map<String, Any?> = mapOf(
    "conectado_en" to instante(ctx, CONECTADO_EN),
    "desconectado_en" to instante(ctx, DESCONECTADO_EN),
    "ultimo_evento" to instante(ctx, ULTIMO_EVENTO),
  )

  fun componente(ctx: Context) = ComponentName(ctx, CapturaListenerService::class.java)

  fun permisoConcedido(ctx: Context): Boolean {
    val cn = componente(ctx)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      return nm.isNotificationListenerAccessGranted(cn)
    }
    val habilitados = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: return false
    return habilitados.split(':').any { ComponentName.unflattenFromString(it) == cn }
  }

  /** Abre el ajuste de acceso a notificaciones (detalle de la app si existe; si no, la lista). */
  fun abrirAjustesPermiso(ctx: Context, actividad: Activity?): Boolean {
    val intentos = mutableListOf<Intent>()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      intentos += Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
        .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, componente(ctx).flattenToString())
    }
    intentos += Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    return lanzarPrimero(ctx, actividad, intentos)
  }

  /** Información de la app: ahí está "Permitir ajustes restringidos" (Android 13+, APK fuera de Play). */
  fun abrirInfoApp(ctx: Context, actividad: Activity?): Boolean = lanzarPrimero(
    ctx,
    actividad,
    listOf(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null))),
  )

  private fun lanzarPrimero(ctx: Context, actividad: Activity?, intentos: List<Intent>): Boolean {
    for (intent in intentos) {
      try {
        if (actividad != null) {
          actividad.startActivity(intent)
        } else {
          ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        return true
      } catch (e: ActivityNotFoundException) {
        continue
      } catch (e: SecurityException) {
        // Algunas capas de fabricante protegen la pantalla de detalle: se prueba la lista.
        continue
      }
    }
    return false
  }

  /** Bancos del catálogo instalados (solo los declarados en `<queries>` son visibles). */
  fun appsInstaladas(ctx: Context): List<Pair<Banco, String>> {
    val pm = ctx.packageManager
    return catalogo(ctx).bancos.flatMap { banco ->
      banco.paquetes.filter { instalado(pm, it) }.map { banco to it }
    }
  }

  @Suppress("DEPRECATION")
  private fun instalado(pm: PackageManager, paquete: String): Boolean = try {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.getPackageInfo(paquete, PackageManager.PackageInfoFlags.of(0))
    } else {
      pm.getPackageInfo(paquete, 0)
    }
    true
  } catch (e: PackageManager.NameNotFoundException) {
    false
  }

  /** Pide al sistema volver a conectar el servicio (fabricantes que lo desconectan). */
  fun solicitarReconexion(ctx: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      NotificationListenerService.requestRebind(componente(ctx))
    }
  }
}
