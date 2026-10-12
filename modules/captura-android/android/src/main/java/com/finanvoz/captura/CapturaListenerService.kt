package com.finanvoz.captura

import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Servicio de notificaciones (`07 §2.2`). El sistema lo enlaza mientras el usuario mantenga el
 * acceso concedido, también con la app cerrada y después de reiniciar (spike S1).
 *
 * Toda la decisión vive en el núcleo puro (`nucleo/Procesador`): si el paquete no está en la
 * lista blanca se descarta sin leer nada más ni escribir nada (regla 10).
 */
class CapturaListenerService : NotificationListenerService() {
  override fun onListenerConnected() {
    super.onListenerConnected()
    Captura.registrarConexion(applicationContext)
    // Relee las notificaciones activas: recupera lo publicado mientras el servicio estuvo
    // desconectado. La cola no repite lo que ya tiene y la huella de la ingesta descarta lo que
    // ya se registró (CA-M5-10).
    val activas = try {
      activeNotifications
    } catch (e: Exception) {
      Log.w(TAG, "No se pudieron leer las notificaciones activas: ${e.javaClass.simpleName}")
      null
    }
    activas?.forEach { procesar(it) }
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    Captura.registrarDesconexion(applicationContext)
    // Algunos fabricantes desconectan el servicio para ahorrar batería: se pide volver.
    // Si el usuario quitó el acceso, el sistema ignora la petición.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      try {
        requestRebind(Captura.componente(applicationContext))
      } catch (e: Exception) {
        Log.w(TAG, "requestRebind falló: ${e.javaClass.simpleName}")
      }
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn != null) procesar(sbn)
  }

  private fun procesar(sbn: StatusBarNotification) {
    try {
      Captura.procesar(applicationContext, FuenteSbn(sbn))
    } catch (e: Exception) {
      // Solo la clase del error: nunca paquete, título ni texto (regla 9).
      Log.w(TAG, "No se pudo procesar una notificación: ${e.javaClass.simpleName}")
    }
  }

  private companion object {
    const val TAG = "CapturaAndroid"
  }
}
