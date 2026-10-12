package com.finanvoz.captura.nucleo

/** Un banco o billetera del catálogo embebido (`captura.bancos.json`). */
data class Banco(val id: String, val nombre: String, val paquetes: List<String>)

/**
 * Catálogo de apps que la captura puede leer. Solo un paquete del catálogo puede entrar a la
 * lista blanca; el usuario elige cuáles (`08 §3.1`: "Solo leemos las apps que marques").
 */
class Catalogo(val bancos: List<Banco>) {
  private val porPaquete: Map<String, Banco> =
    bancos.flatMap { b -> b.paquetes.map { it to b } }.toMap()

  val paquetes: Set<String> get() = porPaquete.keys

  fun bancoDe(paquete: String): Banco? = porPaquete[paquete]

  /** Primer paquete del banco con ese `id` (mapeo de la etiqueta de `adb`, `07 §2.5`). */
  fun primerPaqueteDe(idBanco: String): String? = bancos.firstOrNull { it.id == idBanco }?.paquetes?.firstOrNull()

  operator fun plus(otro: Catalogo): Catalogo = Catalogo(bancos + otro.bancos)

  companion object {
    private val PAQUETE = Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+$")

    fun esPaqueteValido(p: String): Boolean = p.length <= 255 && PAQUETE.matches(p)

    /** Lee `{bancos: [{id, nombre, paquetes_android: [...]}]}`; un archivo inválido es un error. */
    fun deJson(texto: String): Catalogo {
      val raiz = Json.leer(texto) as? Map<*, *> ?: throw Json.ErrorJson("el catálogo no es un objeto")
      val bancos = raiz["bancos"] as? List<*> ?: throw Json.ErrorJson("falta 'bancos'")
      return Catalogo(
        bancos.map { b ->
          val m = b as? Map<*, *> ?: throw Json.ErrorJson("banco inválido")
          val id = m["id"] as? String ?: throw Json.ErrorJson("banco sin id")
          val nombre = m["nombre"] as? String ?: throw Json.ErrorJson("banco sin nombre")
          val paquetes = (m["paquetes_android"] as? List<*> ?: throw Json.ErrorJson("banco sin paquetes"))
            .map { it as? String ?: throw Json.ErrorJson("paquete inválido") }
          if (paquetes.isEmpty() || !paquetes.all(::esPaqueteValido)) throw Json.ErrorJson("paquete inválido en $id")
          Banco(id, nombre, paquetes)
        },
      )
    }
  }
}
