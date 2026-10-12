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

  /**
   * Este catálogo (el de plantillas remotas verificadas en JS, `07 §3.1`) encima de [base]: gana por id de
   * banco y por paquete; de [base] quedan los bancos que no trae ni reclama.
   */
  fun sobre(base: Catalogo): Catalogo {
    val ids = bancos.map { it.id }.toSet()
    val reclamados = paquetes
    return Catalogo(bancos + base.bancos.filter { b -> b.id !in ids && b.paquetes.none { it in reclamados } })
  }

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

/**
 * Bancos de las plantillas remotas (M10, `07 §3.1`) que JS ya verificó con Ed25519. Se guardan en
 * almacenamiento privado para que el servicio los use aunque la app no esté abierta. Un archivo ilegible se
 * ignora (queda el embebido); uno inválido al fijarlo es un error y no reemplaza al anterior.
 */
class CatalogoRemoto(private val almacen: AlmacenTexto) {
  fun leer(): Catalogo? = try {
    almacen.leer()?.let { Catalogo.deJson(it) }
  } catch (e: Json.ErrorJson) {
    null
  }

  /** Valida y guarda `{bancos: [...]}`; `null` lo borra. Devuelve cuántos bancos quedaron. */
  fun fijar(json: String?): Int {
    if (json == null) {
      almacen.borrar()
      return 0
    }
    val catalogo = Catalogo.deJson(json)
    almacen.escribir(json)
    return catalogo.bancos.size
  }
}
