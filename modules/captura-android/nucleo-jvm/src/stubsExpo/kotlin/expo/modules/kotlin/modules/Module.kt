@file:Suppress("FunctionName", "UNUSED_PARAMETER", "unused")

package expo.modules.kotlin.modules

import android.os.Bundle
import expo.modules.kotlin.AppContext

class ModuleDefinitionData

abstract class Module {
  val appContext: AppContext = AppContext()

  abstract fun definition(): ModuleDefinitionData

  fun sendEvent(name: String, body: Bundle? = Bundle.EMPTY) {}

  fun sendEvent(name: String, body: Map<String, Any?>) {}
}

class ModuleDefinitionBuilder {
  fun Name(name: String) {}

  inline fun <reified T> Constant(name: String, crossinline body: () -> T) {}

  fun Events(vararg events: String) {}

  fun OnStartObserving(eventName: String, body: () -> Unit) {}

  fun OnStopObserving(eventName: String, body: () -> Unit) {}

  inline fun OnDestroy(crossinline body: () -> Unit) {}

  @JvmName("AsyncFunctionWithoutArgs")
  inline fun AsyncFunction(name: String, crossinline body: () -> Any?) {}

  inline fun <reified R> AsyncFunction(name: String, crossinline body: () -> R) {}

  inline fun <reified R, reified P0> AsyncFunction(name: String, crossinline body: (p0: P0) -> R) {}

  inline fun <reified R, reified P0, reified P1> AsyncFunction(name: String, crossinline body: (p0: P0, p1: P1) -> R) {}

  fun construir() = ModuleDefinitionData()
}

inline fun Module.ModuleDefinition(crossinline block: ModuleDefinitionBuilder.() -> Unit): ModuleDefinitionData =
  ModuleDefinitionBuilder().also { it.block() }.construir()
