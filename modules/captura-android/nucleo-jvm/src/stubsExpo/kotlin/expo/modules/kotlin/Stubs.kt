// Firmas mínimas de expo-modules-core 57 (copiadas de su código fuente) para compilar
// CapturaModule.kt contra android-all sin el SDK de Android ni React Native. Solo sirven para
// detectar errores de tipos y de API de Android en `gradle verificarAndroid`; no se ejecutan.
@file:Suppress("FunctionName", "UNUSED_PARAMETER", "unused")

package expo.modules.kotlin

import android.app.Activity
import android.content.Context

class AppContext {
  val reactContext: Context? = null
  val currentActivity: Activity? = null
}
