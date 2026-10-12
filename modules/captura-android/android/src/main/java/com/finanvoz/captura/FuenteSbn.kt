package com.finanvoz.captura

import android.app.Notification
import android.service.notification.StatusBarNotification
import com.finanvoz.captura.nucleo.FuenteNotificacion

/**
 * Adaptador perezoso: cada campo se lee de `sbn` solo cuando el núcleo lo pide. Con una app
 * no autorizada el núcleo solo pide `paquete` (regla 10).
 */
internal class FuenteSbn(private val sbn: StatusBarNotification) : FuenteNotificacion {
  override val paquete: String get() = sbn.packageName

  override fun etiqueta(): String? = sbn.tag

  override fun clave(): String = sbn.key

  override fun publicadaEn(): Long = sbn.postTime

  override fun cuandoBruto(): Long = sbn.notification?.`when` ?: 0L

  override fun esResumenDeGrupo(): Boolean =
    ((sbn.notification?.flags ?: 0) and Notification.FLAG_GROUP_SUMMARY) != 0

  override fun enCurso(): Boolean = sbn.isOngoing

  override fun titulo(): CharSequence? = sbn.notification?.extras?.getCharSequence(Notification.EXTRA_TITLE)

  override fun textoGrande(): CharSequence? = sbn.notification?.extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)

  override fun texto(): CharSequence? = sbn.notification?.extras?.getCharSequence(Notification.EXTRA_TEXT)

  override fun nombresDeExtras(): Set<String> = sbn.notification?.extras?.keySet()?.toSet() ?: emptySet()
}
