@file:Suppress("unused")

package expo.modules.kotlin.exception

open class CodedException(code: String?, message: String?, cause: Throwable?) : Exception(message, cause)

class Exceptions {
  class ReactContextLost : CodedException("ERR_REACT_CONTEXT_LOST", "React context lost", null)
}
