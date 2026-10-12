#!/usr/bin/env python3
"""
Oráculo de referencia de los motores de Cartera.

Implementación independiente (Python, solo biblioteca estándar) de las
especificaciones de docs/05-MOTORES.md. Genera fixtures/motores/vectores.json,
que es el CONTRATO que la implementación real (packages/core, TypeScript)
debe reproducir.

    python3 fixtures/motores/oraculo.py --escribir    # regenera vectores.json
    python3 fixtures/motores/oraculo.py --verificar   # CI: falla si vectores.json no coincide
    (En Windows: py -3 en lugar de python3.)

Reglas para quien lo edite:
- No importes nada fuera de la biblioteca estándar.
- Si cambias una especificación, cambia primero docs/05-MOTORES.md, luego
  este archivo, regenera vectores.json y deja constancia en docs/ESTADO.md.
- Dinero siempre en centavos enteros. Fechas civiles como 'YYYY-MM-DD'.
"""
from __future__ import annotations

import calendar
import datetime as dt
import json
import math
import unicodedata

# ---------------------------------------------------------------------------
# E1 · Dinero y fechas
# ---------------------------------------------------------------------------


def distribuir_mayor_residuo(total: int, pesos: list[int]) -> list[int]:
    """Reparte `total` centavos en proporción a `pesos` (enteros >= 0, suma > 0).

    base_i = floor(|total| * p_i / W); el residuo se asigna de 1 en 1 a los
    índices con mayor resto (|total| * p_i mod W); empate -> índice menor.
    Para total negativo se reparte |total| y se cambia el signo.
    """
    assert pesos and all(isinstance(p, int) and p >= 0 for p in pesos)
    w = sum(pesos)
    assert w > 0
    if total == 0:
        return [0] * len(pesos)
    signo = 1 if total > 0 else -1
    t = abs(total)
    base = [t * p // w for p in pesos]
    resto = [t * p % w for p in pesos]
    faltante = t - sum(base)
    orden = sorted(range(len(pesos)), key=lambda i: (-resto[i], i))
    for i in orden[:faltante]:
        base[i] += 1
    return [signo * b for b in base]


def redondear_porcentaje(num: int, den: int) -> int:
    """Porcentaje entero, redondeo a la mitad hacia arriba, solo aritmética entera."""
    return (num * 200 + den) // (2 * den)


def porcentaje_mostrado(exitos: int, n: int) -> str:
    p = redondear_porcentaje(exitos, n)
    if p == 0:
        return "< 1 %"
    if p == 100:
        return "> 99 %"
    return f"{p} %"


def fecha(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


def iso(d: dt.date) -> str:
    return d.isoformat()


def ultimo_dia_mes(anio: int, mes: int) -> int:
    return calendar.monthrange(anio, mes)[1]


def con_dia(anio: int, mes: int, dia: int) -> dt.date:
    """Fecha con día del mes acotado al último día de ese mes."""
    return dt.date(anio, mes, min(dia, ultimo_dia_mes(anio, mes)))


def sumar_meses(anio: int, mes: int, k: int) -> tuple[int, int]:
    total = anio * 12 + (mes - 1) + k
    return total // 12, total % 12 + 1


def dia_semana_iso(d: dt.date) -> int:
    """1 = lunes ... 7 = domingo."""
    return d.isoweekday()


def ajustar_fin_de_semana(d: dt.date, modo: str) -> dt.date:
    ds = dia_semana_iso(d)
    if modo == "ninguno" or ds <= 5:
        return d
    if modo == "anterior":
        return d - dt.timedelta(days=ds - 5)  # sáb -1, dom -2
    if modo == "siguiente":
        return d + dt.timedelta(days=8 - ds)  # sáb +2, dom +1
    raise ValueError(modo)


# ---------------------------------------------------------------------------
# E3 · Ingresos y horizonte
# ---------------------------------------------------------------------------


def fechas_nominales(regla: dict, desde: dt.date, hasta: dt.date) -> list[dt.date]:
    """Fechas nominales (sin ajuste) en [desde, hasta]."""
    tipo = regla["tipo"]
    out: list[dt.date] = []
    if tipo in ("quincenal_15_ultimo", "quincenal_dias", "mensual"):
        a, m = desde.year, desde.month
        while dt.date(a, m, 1) <= hasta:
            if tipo == "quincenal_15_ultimo":
                dias = [15, 31]
            elif tipo == "quincenal_dias":
                dias = regla["dias"]
            else:
                dias = [regla["dia"]]
            for dd in dias:
                f = con_dia(a, m, dd)
                if desde <= f <= hasta:
                    out.append(f)
            a, m = sumar_meses(a, m, 1)
    elif tipo == "semanal":
        f = desde
        while f <= hasta:
            if dia_semana_iso(f) == regla["dia_semana"]:
                out.append(f)
            f += dt.timedelta(days=1)
    elif tipo == "unica":
        f = fecha(regla["fecha"])
        if desde <= f <= hasta:
            out.append(f)
    elif tipo == "anual":
        for a in range(desde.year, hasta.year + 1):
            f = con_dia(a, regla["mes"], regla["dia"])
            if desde <= f <= hasta:
                out.append(f)
    elif tipo == "catorcenal":
        ancla = fecha(regla["ancla"])
        delta = (desde - ancla).days
        k = math.ceil(delta / 14)
        f = ancla + dt.timedelta(days=14 * k)
        while f <= hasta:
            if f >= desde:
                out.append(f)
            f += dt.timedelta(days=14)
    else:
        raise ValueError(tipo)
    return sorted(set(out))


def proximas_fechas(regla: dict, desde: dt.date, n: int) -> list[dt.date]:
    """Primeras n fechas EFECTIVAS (ya ajustadas) >= desde."""
    alcance = 370 * (n + 1) if regla["tipo"] == "anual" else 40 * (n + 2)
    nominales = fechas_nominales(
        regla, desde - dt.timedelta(days=7), desde + dt.timedelta(days=alcance)
    )
    ajustadas = sorted(
        {ajustar_fin_de_semana(f, regla.get("ajuste", "ninguno")) for f in nominales}
    )
    return [f for f in ajustadas if f >= desde][:n]


VENTANA_INGRESO_ANTES = 3    # un depósito puede adelantarse hasta 3 días y cubrir la ocurrencia
VENTANA_INGRESO_DESPUES = 2  # o retrasarse hasta 2 días


def horizonte(hoy: dt.date, regla: dict, recibidas: set[str]) -> dict:
    """fin = primera ocurrencia de ingreso (desde hoy - 2) que NO está cubierta."""
    ocurrencias = proximas_fechas(regla, hoy - dt.timedelta(days=VENTANA_INGRESO_DESPUES), 6)
    pendientes = [f for f in ocurrencias if iso(f) not in recibidas]
    fin = pendientes[0]
    estado = "retrasado" if fin < hoy else ("dia_de_pago" if fin == hoy else "normal")
    if estado == "normal":
        fin_efectivo = fin
    else:
        # El depósito ya debió llegar y no ha llegado: se asume que puede tardar hasta
        # VENTANA_INGRESO_DESPUES días más, para no ofrecer todo el dinero libre en un solo día.
        fin_efectivo = fin + dt.timedelta(days=VENTANA_INGRESO_DESPUES + 1)
    return {
        "fin": iso(fin),
        "fin_efectivo": iso(fin_efectivo),
        "dias": (fin_efectivo - hoy).days,
        "estado": estado,
    }


def horizonte_variable(hoy: dt.date) -> dict:
    fin = hoy + dt.timedelta(days=30)
    return {"fin": iso(fin), "fin_efectivo": iso(fin), "dias": 30, "estado": "ingreso_variable"}


def expandir_programados(programados: list[dict], desde: dt.date, hasta: dt.date) -> list[dict]:
    """Instancias (ya ajustadas) de egresos programados con fecha en [desde, hasta).
    Las nominales se generan en [desde - 7, hasta + 7] para no perder las que el ajuste mueve."""
    out = []
    for p in programados:
        regla = p["regla"]
        nominales = fechas_nominales(regla, desde - dt.timedelta(days=7), hasta + dt.timedelta(days=7))
        for f in sorted({ajustar_fin_de_semana(f, regla.get("ajuste", "ninguno")) for f in nominales}):
            if desde <= f < hasta:
                out.append({"concepto": p["concepto"], "fecha": iso(f), "monto": p["monto"]})
    out.sort(key=lambda x: (x["fecha"], x["concepto"]))
    return out


def cubre_ocurrencia(oc: dict, mov: dict) -> str:
    """Decide si un movimiento cubre una ocurrencia programada: 'cubrir' | 'preguntar' | 'no'."""
    df = (fecha(mov["fecha"]) - fecha(oc["fecha"])).days
    if oc.get("cuenta") and oc["cuenta"] != mov["cuenta"]:
        return "no"
    if oc["tipo"] == "ingreso":
        if mov["sentido"] != "entrada" or not (-VENTANA_INGRESO_ANTES <= df <= VENTANA_INGRESO_DESPUES):
            return "no"
        return "cubrir" if abs(mov["monto"] - oc["monto"]) * 100 <= 10 * oc["monto"] else "no"
    if mov["sentido"] != "salida" or not (-3 <= df <= 3):
        return "no"
    por_categoria = bool(oc.get("categoria")) and oc.get("categoria") == mov.get("categoria")
    por_comercio = bool(oc.get("comercio")) and similitud(
        normalizar_comercio(oc["comercio"]), normalizar_comercio(mov.get("comercio"))) >= 0.85
    if not (por_categoria or por_comercio):
        return "no"
    if mov["monto"] == oc["monto"]:
        return "cubrir"
    if abs(mov["monto"] - oc["monto"]) * 100 <= 25 * oc["monto"]:
        return "cubrir" if oc.get("variable") else "preguntar"
    return "no"


# ---------------------------------------------------------------------------
# E4 · Dinero libre
# ---------------------------------------------------------------------------


def dinero_libre(e: dict) -> dict:
    hoy = fecha(e["hoy"])
    fin_ef = max(fecha(e["fin_horizonte"]), hoy + dt.timedelta(days=1))
    d = (fin_ef - hoy).days

    def en_h(f: str) -> bool:
        return fecha(f) < fin_ef  # incluye vencidos no pagados

    comp = sum(c["monto"] for c in e["compromisos"] if en_h(c["fecha"]))
    tarj_completo = 0
    tarj_plan = 0
    for t in e["tarjetas"]:
        if t["modo"] == "plan" and t.get("pagos_planeados"):
            tarj_plan += sum(p["monto"] for p in t["pagos_planeados"] if en_h(p["fecha"]))
        else:  # totalera, o en plan sin pagos planeados (conservador)
            tarj_completo += max(0, t["saldo_revolvente"])  # un saldo a favor no crea dinero libre
    msi = sum(c["monto"] for c in e["cuotas_msi_no_facturadas"] if en_h(c["fecha_limite"]))
    deudas = sum(x["monto"] for x in e.get("deudas_personas", []) if x["apartar"])
    # Espacio negocio: impuestos estimados no pagados (E15). Se apartan completos aunque venzan
    # después del horizonte: es dinero que ya no es del dueño.
    impuestos = max(0, e.get("impuestos_estimados", 0))
    reservado = comp + tarj_completo + tarj_plan + msi + deudas + impuestos
    libre = e["liquidez"] - e["colchon"] - reservado
    hoy_puedes = libre // d if libre > 0 else 0
    return {
        "dias": d,
        "reservado": reservado,
        "desglose": {
            "compromisos": comp,
            "tarjetas_saldo_completo": tarj_completo,
            "tarjetas_pagos_planeados": tarj_plan,
            "cuotas_msi": msi,
            "deudas_personas": deudas,
            "impuestos": impuestos,
        },
        "libre": libre,
        "hoy_puedes_centavos": hoy_puedes,
        "hoy_puedes_pesos_mostrados": hoy_puedes // 100,
        "faltante": -libre if libre < 0 else 0,
    }


# ---------------------------------------------------------------------------
# E5 · Tarjetas
# ---------------------------------------------------------------------------


def corte_de(compra: dt.date, dia_corte: int) -> dt.date:
    c = con_dia(compra.year, compra.month, dia_corte)
    if c >= compra:
        return c
    a, m = sumar_meses(compra.year, compra.month, 1)
    return con_dia(a, m, dia_corte)


def siguiente_corte(corte: dt.date, dia_corte: int) -> dt.date:
    a, m = sumar_meses(corte.year, corte.month, 1)
    return con_dia(a, m, dia_corte)


def limite_de(corte: dt.date, t: dict) -> dt.date:
    if t.get("dias_para_pagar") is not None:
        return corte + dt.timedelta(days=t["dias_para_pagar"])
    dl = t["dia_limite_pago"]
    c = con_dia(corte.year, corte.month, dl)
    if c > corte:
        return c
    a, m = sumar_meses(corte.year, corte.month, 1)
    return con_dia(a, m, dl)


def dias_financiamiento(compra: dt.date, t: dict) -> dict:
    c = corte_de(compra, t["dia_corte"])
    lim = limite_de(c, t)
    return {"corte": iso(c), "limite": iso(lim), "dias": (lim - compra).days}


def recomendar_tarjeta(compra: dict, tarjetas: list[dict], umbral_uso_bp: int = 3000) -> dict:
    """umbral_uso_bp en puntos base (3000 = 30 %)."""
    f = fecha(compra["fecha"])
    candidatas = []
    for t in tarjetas:
        if t["modo"] != "totalero":
            continue
        deuda = max(0, t["saldo_revolvente"]) + t["msi_no_facturado"] + compra["monto"]
        uso_bp = deuda * 10000 // t["limite_credito"]
        fin = dias_financiamiento(f, t)
        candidatas.append({"id": t["id"], "uso_bp": uso_bp, **fin})
    elegibles = [c for c in candidatas if c["uso_bp"] <= umbral_uso_bp]
    advertencia = None
    if not elegibles:
        elegibles = [c for c in candidatas if c["uso_bp"] <= 10000]
        advertencia = "uso_alto" if elegibles else "sin_credito_disponible"
    if not elegibles:
        return {"tarjeta": None, "advertencia": advertencia, "candidatas": candidatas}
    elegibles.sort(key=lambda c: (-c["dias"], c["uso_bp"], c["id"]))
    return {"tarjeta": elegibles[0], "advertencia": advertencia, "candidatas": candidatas}


# ---------------------------------------------------------------------------
# E6 · Meses sin intereses
# ---------------------------------------------------------------------------


def plan_msi(monto: int, meses: int, fecha_compra: str, t: dict, meses_diferimiento: int = 0) -> list[dict]:
    cuotas = distribuir_mayor_residuo(monto, [1] * meses)
    c = corte_de(fecha(fecha_compra), t["dia_corte"])
    for _ in range(meses_diferimiento):
        c = siguiente_corte(c, t["dia_corte"])
    out = []
    for k, cuota in enumerate(cuotas, start=1):
        out.append({"n": k, "monto": cuota, "corte": iso(c), "limite": iso(limite_de(c, t))})
        c = siguiente_corte(c, t["dia_corte"])
    return out


def plan_msi_existente(mensualidad: int, restantes: int, hoy: str, t: dict) -> dict:
    """Plan que ya existía al dar de alta la tarjeta (onboarding): solo las cuotas que faltan.
    La primera se factura en el primer corte ESTRICTAMENTE posterior a hoy."""
    c = corte_de(fecha(hoy) + dt.timedelta(days=1), t["dia_corte"])
    cuotas = []
    for k in range(1, restantes + 1):
        cuotas.append({"n": k, "monto": mensualidad, "corte": iso(c), "limite": iso(limite_de(c, t))})
        c = siguiente_corte(c, t["dia_corte"])
    return {"saldo_msi": mensualidad * restantes, "cuotas": cuotas}


def cortes_a_procesar(t: dict, alta: str, hoy: str, procesados: set[str]) -> list[str]:
    """Cortes c con alta < c <= hoy que no se han procesado (nunca antes del alta de la tarjeta)."""
    c = corte_de(fecha(alta) + dt.timedelta(days=1), t["dia_corte"])
    out = []
    while c <= fecha(hoy):
        if iso(c) not in procesados:
            out.append(iso(c))
        c = siguiente_corte(c, t["dia_corte"])
    return out


def compromiso_msi_por_mes(cuotas: list[dict]) -> dict:
    acc: dict[str, int] = {}
    for q in cuotas:
        mes = q["limite"][:7]
        acc[mes] = acc.get(mes, 0) + q["monto"]
    return dict(sorted(acc.items()))


# ---------------------------------------------------------------------------
# E7 · Arqueo de efectivo
# ---------------------------------------------------------------------------

UMBRAL_REPARTO = 5000  # $50.00: debajo de esto todo va a varios_efectivo


def arqueo(saldo_contable: int, efectivo_real: int, historial: list[dict], marcados: list[int] = ()) -> dict:
    """marcados: montos 'por asignar' que el usuario confirmó como pagados en efectivo en este arqueo.
    Se reasignan primero; el hueco se calcula después (si no, se contarían dos veces)."""
    reasignado = sum(marcados)
    hueco = saldo_contable - reasignado - efectivo_real
    if hueco == 0:
        return {"reasignado": reasignado, "hueco": 0, "accion": "ninguna", "propuesta": []}
    if hueco < 0:
        return {"reasignado": reasignado, "hueco": hueco, "accion": "aclarar_sobrante", "propuesta": []}
    agg: dict[str, int] = {}
    for h in historial:
        agg[h["categoria"]] = agg.get(h["categoria"], 0) + h["monto"]
    agg = {k: v for k, v in agg.items() if v > 0}
    if hueco < UMBRAL_REPARTO or not agg:
        return {
            "reasignado": reasignado,
            "hueco": hueco,
            "accion": "proponer_gastos_estimados",
            "propuesta": [{"categoria": "varios_efectivo", "monto": hueco}],
        }
    orden = sorted(agg.items(), key=lambda kv: (-kv[1], kv[0]))
    top = orden[:3]
    resto = sum(v for _, v in orden[3:])
    cats = [k for k, _ in top]
    pesos = [v for _, v in top]
    if resto > 0:
        cats.append("varios_efectivo")
        pesos.append(resto)
    montos = distribuir_mayor_residuo(hueco, pesos)
    return {
        "reasignado": reasignado,
        "hueco": hueco,
        "accion": "proponer_gastos_estimados",
        "propuesta": [{"categoria": c, "monto": m} for c, m in zip(cats, montos)],
    }


def corte_de_caja(saldo_contable: int, efectivo_real: int, marcados: list[int] = ()) -> dict:
    """E7.2 · Caja de un negocio. Al revés que el arqueo personal: lo normal es que sobre dinero,
    porque las ventas en efectivo no se anotan una por una."""
    reasignado = sum(marcados)
    esperado = saldo_contable - reasignado
    diferencia = efectivo_real - esperado
    base = {"reasignado": reasignado, "esperado": esperado, "diferencia": diferencia}
    if diferencia == 0:
        return {**base, "accion": "ninguna", "propuesta": []}
    if diferencia > 0:
        return {**base, "accion": "proponer_ventas", "propuesta": [{"categoria": "ventas", "monto": diferencia}]}
    return {**base, "accion": "aclarar_faltante", "propuesta": []}


# ---------------------------------------------------------------------------
# E8 · Simulador (PRNG, semilla, Monte Carlo)
# ---------------------------------------------------------------------------

M32 = 0xFFFFFFFF


def imul(a: int, b: int) -> int:
    return (a * b) & M32


def mulberry32(semilla: int):
    estado = semilla & M32

    def siguiente() -> float:
        nonlocal estado
        estado = (estado + 0x6D2B79F5) & M32
        a = estado
        t = imul(a ^ (a >> 15), 1 | a)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) & M32) ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return siguiente


def fnv1a32(texto: str) -> int:
    h = 0x811C9DC5
    for b in texto.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & M32
    return h


def clase_dia(d: dt.date, fechas_ingreso: set[dt.date]) -> str:
    if d in fechas_ingreso:
        return "pago"
    return "finde" if dia_semana_iso(d) >= 6 else "habil"


MIN_POOL = 5
MIN_DIAS_HISTORIAL = 14


def construir_pools(historial: list[dict]) -> dict[str, list[int]]:
    todos = [h["consumo"] for h in historial]
    pools = {}
    for clase in ("habil", "finde", "pago"):
        p = [h["consumo"] for h in historial if h["clase"] == clase]
        pools[clase] = p if len(p) >= MIN_POOL else todos
    return pools


TIPOS_CONSUMO = {"gasto", "cuenta_dividida", "ajuste_arqueo", "reembolso"}


def construir_historial(transacciones: list[dict], inicio_uso: str, hoy: str, fechas_ingreso: list[str], ventana: int = 90) -> list[dict]:
    """Un registro por día completo en [max(inicio_uso, hoy - ventana), hoy).
    transacciones: {fecha, tipo, monto_gasto (Σ de asientos en cuentas de gasto; la parte del usuario
    en cuenta_dividida; negativo en reembolso), cubre_ocurrencia, extraordinaria, arqueo_anterior?}"""
    h = fecha(hoy)
    desde = max(fecha(inicio_uso), h - dt.timedelta(days=ventana))
    dias = []
    d = desde
    while d < h:
        dias.append(d)
        d += dt.timedelta(days=1)
    acc = {d: 0 for d in dias}
    for t in transacciones:
        if t["tipo"] not in TIPOS_CONSUMO or t.get("cubre_ocurrencia") or t.get("extraordinaria"):
            continue
        if t["tipo"] == "ajuste_arqueo":
            fin = fecha(t["fecha"])
            if t.get("arqueo_anterior"):
                ini = fecha(t["arqueo_anterior"]) + dt.timedelta(days=1)
            else:
                ini = max(fecha(inicio_uso), fin - dt.timedelta(days=6))
            tramo = [ini + dt.timedelta(days=k) for k in range((fin - ini).days + 1)]
            for dia, parte in zip(tramo, distribuir_mayor_residuo(t["monto_gasto"], [1] * len(tramo))):
                if dia in acc:
                    acc[dia] += parte
        else:
            dia = fecha(t["fecha"])
            if dia in acc:
                acc[dia] += t["monto_gasto"]
    pagos = {fecha(f) for f in fechas_ingreso}
    return [{"fecha": iso(d), "clase": clase_dia(d, pagos), "consumo": max(0, acc[d])} for d in dias]


def cuantil(ordenados: list[int], p_bp: int) -> int:
    """Rango más cercano: elemento ceil(p*N)-1 de la lista ordenada (p en puntos base)."""
    n = len(ordenados)
    k = max(1, -(-p_bp * n // 10000))  # ceil sin flotantes
    return ordenados[k - 1]


def simular(e: dict) -> dict:
    """Monte Carlo por bootstrap estratificado. Ver docs/05-MOTORES.md §E8."""
    if len(e["historial"]) < MIN_DIAS_HISTORIAL:
        return {"estado": "datos_insuficientes"}
    pools = construir_pools(e["historial"])
    horizontes = e["horizontes"]  # [{inicio, fin, ingreso, compromisos}]
    fechas_ingreso = {fecha(h["inicio"]) for h in horizontes[1:]}
    if e.get("hoy_es_dia_de_pago"):
        fechas_ingreso.add(fecha(horizontes[0]["inicio"]))
    dias_por_h = []
    for h in horizontes:
        ini, fin = fecha(h["inicio"]), fecha(h["fin"])
        dias = []
        d = ini
        while d < fin:
            dias.append(pools[clase_dia(d, fechas_ingreso)])
            d += dt.timedelta(days=1)
        dias_por_h.append(dias)
    rng = mulberry32(e["semilla"])
    n = e["n"]
    exitos = 0
    finales_h0 = []
    for _ in range(n):
        excedente = e["excedente_inicial"]
        ok = True
        for k, h in enumerate(horizontes):
            if k > 0:
                excedente += h["ingreso"] - h["compromisos"]
            for pool in dias_por_h[k]:
                excedente -= pool[int(rng() * len(pool))]
            if k == 0:
                finales_h0.append(excedente)
            if excedente < 0:
                ok = False
        exitos += ok
    finales_h0.sort()
    return {
        "estado": "ok",
        "exitos": exitos,
        "probabilidad": exitos / n,
        "p10_h0": cuantil(finales_h0, 1000),
        "p50_h0": cuantil(finales_h0, 5000),
        "p90_h0": cuantil(finales_h0, 9000),
    }


# --- E8 · Horizontes múltiples y escenarios de compra ("¿Me alcanza?") ---

TOPE_MESES_VENTANA = 24


def construir_horizontes(hoy: str, regla_ingreso: dict, monto_ingreso: int, programados: list[dict],
                         hasta: str, recibidas: set[str] = frozenset(), min_horizontes: int = 2) -> list[dict]:
    """H0 = [hoy, fin_efectivo de E3); después un horizonte por cada ocurrencia de ingreso pendiente.
    Se generan hasta que el último horizonte termina después de `hasta` (y al menos min_horizontes),
    con tope de 24 meses. Los compromisos de H0 no se cuentan: ya están en el dinero libre (E4)."""
    h = fecha(hoy)
    a, m = sumar_meses(h.year, h.month, TOPE_MESES_VENTANA)
    tope = con_dia(a, m, h.day)
    limite = min(fecha(hasta), tope)
    fin0 = fecha(horizonte(h, regla_ingreso, recibidas)["fin_efectivo"])
    siguientes = [f for f in proximas_fechas(regla_ingreso, fin0 + dt.timedelta(days=1), 80) if iso(f) not in recibidas]
    inicios = [h, fin0] + siguientes
    out = []
    for k in range(len(inicios) - 1):
        ini, fin = inicios[k], inicios[k + 1]
        comp = 0 if k == 0 else sum(x["monto"] for x in expandir_programados(programados, ini, fin))
        out.append({"inicio": iso(ini), "fin": iso(fin), "ingreso": 0 if k == 0 else monto_ingreso, "compromisos": comp})
        if len(out) >= min_horizontes and fin > limite:
            break
    return out


def _indice_horizonte(horizontes: list[dict], f: str) -> int | None:
    for k, hz in enumerate(horizontes):
        if hz["inicio"] <= f < hz["fin"]:
            return k
    return None


UMBRAL_PRECIO_MSI = 100000  # $1,000: debajo de esto no se ofrece escenario a meses si el usuario no lo pidió


def generar_escenarios(precio: int, hoy: str, proximo_ingreso: str, tarjetas: list[dict],
                       meses: int | None = None, fecha_compra: str | None = None) -> dict:
    escenarios = [{"tipo": "base"}, {"tipo": "contado_hoy", "precio": precio}]
    f_esperar = fecha_compra or proximo_ingreso
    if f_esperar and f_esperar > hoy:
        escenarios.append({"tipo": "esperar", "precio": precio, "fecha": f_esperar})
    nota = None
    lista_meses = [meses] if meses else ([3] if precio >= UMBRAL_PRECIO_MSI else [])
    if lista_meses:
        r = recomendar_tarjeta({"fecha": hoy, "monto": precio}, tarjetas)
        if r["tarjeta"]:
            for mm in lista_meses:
                escenarios.append({"tipo": "msi", "precio": precio, "meses": mm, "tarjeta": r["tarjeta"]["id"]})
            nota = r["advertencia"]
        else:
            nota = "sin_tarjeta_para_msi"
    return {"escenarios": escenarios, "nota": nota}


def _cargos(esc: dict, hoy: str, tarjetas: dict) -> list[tuple[str, int]]:
    if esc["tipo"] == "contado_hoy":
        return [(hoy, esc["precio"])]
    if esc["tipo"] == "esperar":
        return [(esc["fecha"], esc["precio"])]
    if esc["tipo"] == "msi":
        return [(q["limite"], q["monto"]) for q in plan_msi(esc["precio"], esc["meses"], hoy, tarjetas[esc["tarjeta"]])]
    return []


PREFERENCIA = {"contado_hoy": 0, "esperar": 1, "msi": 2}
EMPATE_BP = 200  # 2 puntos porcentuales


def comparar_escenarios(e: dict) -> dict:
    hoy = e["hoy"]
    tarjetas = {t["id"]: t for t in e["tarjetas"]}
    cargos = [_cargos(esc, hoy, tarjetas) for esc in e["escenarios"]]
    hasta = max([hoy] + [f for cs in cargos for f, _ in cs])
    hs = construir_horizontes(hoy, e["regla_ingreso"], e["monto_ingreso"], e["programados"], hasta, set(e.get("recibidas", [])))
    dias_ventana = (fecha(hs[-1]["fin"]) - fecha(hoy)).days
    n = 10000 if dias_ventana <= 62 else 5000
    resultados = []
    for esc, cs in zip(e["escenarios"], cargos):
        copia = json.loads(json.dumps(hs))
        e0 = e["excedente_inicial"]
        parcial = False
        for f, monto in cs:
            k = _indice_horizonte(copia, f)
            if k is None:
                parcial = True        # cae después del tope de 24 meses
            elif k == 0:
                e0 -= monto
            else:
                copia[k]["compromisos"] += monto
        r = simular({"historial": e["historial"], "horizontes": copia, "excedente_inicial": e0, "n": n, "semilla": e["semilla"]})
        resultados.append({"escenario": esc, "excedente_inicial": e0, "exitos": r["exitos"], "probabilidad": r["probabilidad"],
                           "porcentaje": porcentaje_mostrado(r["exitos"], n), "parcial": parcial})
    compras = [r for r in resultados if r["escenario"]["tipo"] != "base"]
    mejor = max(r["exitos"] for r in compras)
    empatados = [r for r in compras if (mejor - r["exitos"]) * 10000 <= EMPATE_BP * n]
    empatados.sort(key=lambda r: (PREFERENCIA[r["escenario"]["tipo"]], r["escenario"].get("fecha", hoy)))
    return {"horizontes_usados": len(hs), "ventana_hasta": hs[-1]["fin"], "dias_ventana": dias_ventana, "n": n,
            "resultados": resultados, "recomendado": empatados[0]["escenario"]}


# ---------------------------------------------------------------------------
# E9 · Normalización de comercios y deduplicación
# ---------------------------------------------------------------------------

PALABRAS_VACIAS = {
    "SA", "DE", "CV", "SAPI", "SAB", "S", "A", "C", "V", "RL", "MX", "MEX",
    "SUC", "SUCURSAL", "TDA", "TIENDA", "POS", "COMPRA", "PAGO", "EN",
}


def normalizar_comercio(s: str | None) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.upper()
    s = "".join(ch if ("A" <= ch <= "Z" or "0" <= ch <= "9") else " " for ch in s)
    tokens = [t for t in s.split() if not t.isdigit() and t not in PALABRAS_VACIAS]
    return " ".join(tokens)


def jaro(s1: str, s2: str) -> float:
    if s1 == s2:
        return 1.0 if s1 else 0.0
    l1, l2 = len(s1), len(s2)
    if l1 == 0 or l2 == 0:
        return 0.0
    ventana = max(max(l1, l2) // 2 - 1, 0)
    m1, m2 = [False] * l1, [False] * l2
    m = 0
    for i in range(l1):
        for j in range(max(0, i - ventana), min(i + ventana + 1, l2)):
            if not m2[j] and s1[i] == s2[j]:
                m1[i] = m2[j] = True
                m += 1
                break
    if m == 0:
        return 0.0
    fuera = 0
    k = 0
    for i in range(l1):
        if m1[i]:
            while not m2[k]:
                k += 1
            if s1[i] != s2[k]:
                fuera += 1
            k += 1
    t = fuera / 2
    return (m / l1 + m / l2 + (m - t) / m) / 3


def jaro_winkler(s1: str, s2: str) -> float:
    j = jaro(s1, s2)
    if j <= 0.7:
        return j
    pref = 0
    for a, b in zip(s1[:4], s2[:4]):
        if a != b:
            break
        pref += 1
    return j + pref * 0.1 * (1 - j)


def similitud(a: str, b: str) -> float:
    """a y b ya normalizados."""
    if not a or not b:
        return 0.0
    ta, tb = a.split(), b.split()
    corto, largo = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    if set(corto) <= set(largo):
        return 1.0
    return jaro_winkler(a, b)


def decidir_duplicado(captura: dict, mov: dict) -> dict:
    """captura: {cuenta, monto, fecha, comercio, sentido ('salida' por defecto | 'entrada')}
    mov: {cuenta, cuenta_raiz?, monto, fecha, comercio, tipo?}. Una subcuenta MSI usa su tarjeta como raíz.
    Un movimiento en la cuenta puente (por_asignar / por_asignar_entradas) es compatible con cualquier cuenta."""
    sentido = captura.get("sentido", "salida")
    puente = "por_asignar" if sentido == "salida" else "por_asignar_entradas"
    cuenta_mov = mov.get("cuenta_raiz", mov["cuenta"])
    if cuenta_mov not in (captura["cuenta"], puente):
        return {"decision": "nuevo", "delta_dias": None, "similitud": None}
    delta = abs((fecha(captura["fecha"]) - fecha(mov["fecha"])).days)
    if captura["monto"] != mov["monto"]:
        if (sentido == "entrada" and mov.get("tipo") == "ingreso" and delta <= 2
                and abs(captura["monto"] - mov["monto"]) * 100 <= 10 * captura["monto"]):
            return {"decision": "preguntar", "delta_dias": delta, "similitud": None}
        return {"decision": "nuevo", "delta_dias": delta, "similitud": None}
    if cuenta_mov == puente or not mov.get("comercio"):
        if delta <= 1:
            dec = "fusionar"
        elif delta == 2:
            dec = "preguntar"
        else:
            dec = "nuevo"
        return {"decision": dec, "delta_dias": delta, "similitud": None}
    s = similitud(normalizar_comercio(captura.get("comercio")), normalizar_comercio(mov["comercio"]))
    if delta <= 1 and s >= 0.85:
        dec = "fusionar"
    elif delta <= 2 and s >= 0.70:
        dec = "preguntar"
    else:
        dec = "nuevo"
    return {"decision": dec, "delta_dias": delta, "similitud": round(s, 6)}


def emparejar_transferencias(salidas: list[dict], entradas: list[dict]) -> list[dict]:
    """E9.4: une la salida de una cuenta propia con la entrada en otra cuenta propia.
    Cada captura trae 'espacio' (por omisión 'personal'). Si el par cruza espacios, el movimiento es
    retiro_dueno (negocio → personal) o aportacion_dueno (personal → negocio); si además la entrada es el
    pago de una tarjeta, 'pago_tarjeta': True indica que servicios lo descompone (04 §2.4)."""
    pares = []
    for s_ in salidas:
        for e in entradas:
            if s_["cuenta"] == e["cuenta"] or s_["monto"] != e["monto"]:
                continue
            delta = abs((fecha(s_["fecha"]) - fecha(e["fecha"])).days)
            if delta <= 1:
                pares.append((delta, s_["id"], e["id"]))
    pares.sort()
    por_id = {x["id"]: x for x in salidas + entradas}
    registradas = {x["id"] for x in salidas + entradas if x.get("ya_registrada")}
    usadas_s, usadas_e, out = set(), set(), []
    for delta, sid, eid in pares:
        if sid in usadas_s or eid in usadas_e:
            continue
        usadas_s.add(sid); usadas_e.add(eid)
        es, ee = por_id[sid].get("espacio", "personal"), por_id[eid].get("espacio", "personal")
        es_pago_tarjeta = por_id[eid]["tipo"] == "pago_recibido_tarjeta"
        par = {"salida": sid, "entrada": eid}
        if es == ee:
            par["movimiento"] = "pago_tarjeta" if es_pago_tarjeta else "transferencia"
        else:
            par["movimiento"] = "retiro_dueno" if es == "negocio" else "aportacion_dueno"
            par["pago_tarjeta"] = es_pago_tarjeta
        par["reemplazar"] = sorted(x for x in (sid, eid) if x in registradas)
        out.append(par)
    return out


# ---------------------------------------------------------------------------
# NLU · Resolutor de cuentas (docs/06-NLU.md §5)
# ---------------------------------------------------------------------------

PALABRAS_ALIAS = {"la", "el", "los", "las", "mi", "mis", "de", "del", "con", "tarjeta", "cuenta"}
UMBRAL_ALIAS_DIFUSO = 0.92


def normalizar_alias(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = "".join(ch if ch.isalnum() else " " for ch in s)
    return " ".join(t for t in s.split() if t not in PALABRAS_ALIAS)


def resolver_cuenta(ref: dict, cuentas: list[dict]) -> dict:
    """ref.espacio (por defecto 'personal') filtra las candidatas: el efectivo de la caja del negocio
    nunca compite con la cartera personal."""
    compatibles = {
        "efectivo": {"efectivo"}, "debito": {"debito"}, "credito": {"credito"},
        "tarjeta": {"debito", "credito"}, "desconocido": {"efectivo", "debito", "credito"},
    }[ref["tipo"]]
    espacio = ref.get("espacio", "personal")
    alias = ref.get("alias")
    # Con alias se busca en todos los espacios (decir "la de Banorte" basta para saber que es del negocio);
    # sin alias, solo en el espacio del movimiento.
    cand = [c for c in cuentas if c["tipo"] in compatibles and (alias or c.get("espacio", "personal") == espacio)]
    if alias:
        a = normalizar_alias(alias)
        exactas = [c for c in cand if a in {normalizar_alias(x) for x in c["alias"]} or a == normalizar_alias(c["nombre"])]
        if len(exactas) > 1:  # el mismo alias en dos espacios: gana el del movimiento
            del_espacio = [c for c in exactas if c.get("espacio", "personal") == espacio]
            if len(del_espacio) == 1:
                exactas = del_espacio
        if len(exactas) == 1:
            return {"resultado": "cuenta", "cuenta": exactas[0]["id"]}
        if len(exactas) > 1:
            return {"resultado": "ambigua", "candidatas": sorted(c["id"] for c in exactas)}
        puntajes = []
        for c in cand:
            mejor = max(jaro_winkler(a.upper(), normalizar_alias(x).upper()) for x in c["alias"])
            puntajes.append((mejor, c["id"]))
        puntajes.sort(reverse=True)
        if puntajes and puntajes[0][0] >= UMBRAL_ALIAS_DIFUSO and (len(puntajes) == 1 or puntajes[1][0] < puntajes[0][0]):
            return {"resultado": "cuenta", "cuenta": puntajes[0][1], "aproximado": True}
        return {"resultado": "no_encontrada"}
    if ref["tipo"] == "desconocido":
        return {"resultado": "por_asignar"}
    if len(cand) == 1:
        return {"resultado": "cuenta", "cuenta": cand[0]["id"]}
    if not cand:
        return {"resultado": "no_encontrada"}
    return {"resultado": "ambigua", "candidatas": sorted(c["id"] for c in cand)}


def vectores_resolver():
    import os
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "nlu", "contexto.json")
    cuentas = json.load(open(ruta, encoding="utf-8"))["cuentas"]
    norm = [{"entrada": s, "esperado": normalizar_alias(s)} for s in
            ["la de Nómina", "con la Nu", "mi cuenta de BBVA", "Tarjeta ORO", "Mercado-Pago", "la morada"]]
    casos = []
    for i, ref in [
        ("R-01", {"tipo": "credito", "alias": "nu"}),
        ("R-02", {"tipo": "credito"}),
        ("R-03", {"tipo": "debito"}),
        ("R-04", {"tipo": "debito", "alias": "nomina"}),
        ("R-05", {"tipo": "efectivo"}),
        ("R-06", {"tipo": "tarjeta"}),
        ("R-07", {"tipo": "desconocido"}),
        ("R-08", {"tipo": "credito", "alias": "azul"}),
        ("R-09", {"tipo": "credito", "alias": "banamx"}),
        ("R-10", {"tipo": "desconocido", "alias": "mercado pago"}),
        ("R-11", {"tipo": "debito", "alias": "nu"}),
        ("R-12", {"tipo": "credito", "alias": "la morada"}),
        ("R-13", {"tipo": "efectivo", "espacio": "negocio"}),
        ("R-14", {"tipo": "debito", "alias": "banorte"}),
        ("R-15", {"tipo": "credito", "espacio": "negocio"}),
        ("R-16", {"tipo": "efectivo", "alias": "caja"}),
    ]:
        casos.append({"id": i, "ref": ref, "esperado": resolver_cuenta(ref, cuentas)})
    return {"contexto": "fixtures/nlu/contexto.json", "normalizar_alias": norm, "resolver": casos}


# ---------------------------------------------------------------------------
# E10 · Capacidad de endeudamiento (calculadora M0)
# ---------------------------------------------------------------------------


def capacidad(e: dict) -> dict:
    ingreso = e["ingreso_mensual_neto"]
    tope_deuda = ingreso * e.get("tope_deuda_bp", 3000) // 10000
    tope_msi = ingreso * e.get("tope_msi_bp", 1000) // 10000
    cap_deuda = tope_deuda - e["pagos_deuda_mensuales"]
    cap_msi = tope_msi - e["pagos_msi_mensuales"]
    cap = max(0, min(cap_deuda, cap_msi))
    out = {
        "tope_deuda": tope_deuda,
        "tope_msi": tope_msi,
        "capacidad_mensual": cap,
        "limitante": "deuda_total" if cap_deuda <= cap_msi else "msi",
        "precio_maximo": {str(n): cap * n for n in (3, 6, 9, 12, 18, 24)},
    }
    if "compra" in e:
        cuotas = distribuir_mayor_residuo(e["compra"]["precio"], [1] * e["compra"]["meses"])
        cuota_max = max(cuotas)
        out["compra"] = {
            "cuota_maxima": cuota_max,
            "cabe": cuota_max <= cap,
            "margen": cap - cuota_max,
        }
    return out


# ---------------------------------------------------------------------------
# E11 · Tandas
# ---------------------------------------------------------------------------


def tanda(aportacion: int, participantes: int, turno: int, regla: dict, inicio: str) -> list[dict]:
    fechas = proximas_fechas(regla, fecha(inicio), participantes)
    out = []
    for t in range(1, participantes + 1):
        aportado = aportacion * t
        recibido = aportacion * participantes if t >= turno else 0
        posicion = aportado - recibido
        out.append({
            "t": t,
            "fecha": iso(fechas[t - 1]),
            "aportado": aportado,
            "recibido": recibido,
            "posicion": posicion,
            "en_riesgo": max(0, posicion),
            "por_aportar": aportacion * (participantes - t),
        })
    return out


def tanda_existente(aportacion: int, participantes: int, turno: int, regla: dict, inicio: str, hoy: str) -> dict:
    """E11 · Tanda que ya había empezado al registrarla: las rondas con fecha < hoy se toman como aportadas
    (el usuario puede corregir el número). Su posición se registra como saldo inicial y esas ocurrencias
    quedan omitidas (no se reservan ni se vuelven a cobrar)."""
    rondas = proximas_fechas(regla, fecha(inicio), participantes)
    h = fecha(hoy)
    hechas = sum(1 for f in rondas if f < h)
    recibido = aportacion * participantes if hechas >= turno else 0
    return {
        "aportaciones_hechas": hechas,
        "ya_cobro": hechas >= turno,
        "saldo_inicial": aportacion * hechas - recibido,
        "ocurrencias_omitidas": [iso(f) for f in rondas if f < h],
        "ocurrencias_pendientes": [iso(f) for f in rondas if f >= h],
        "fecha_cobro": iso(rondas[turno - 1]),
    }


# ---------------------------------------------------------------------------
# E12 · Cuenta dividida
# ---------------------------------------------------------------------------


def dividir_cuenta(total: int, partes: int) -> dict:
    """El índice 0 es quien pagó: absorbe los centavos sobrantes."""
    cuotas = distribuir_mayor_residuo(total, [1] * partes)
    return {
        "parte_usuario": cuotas[0],
        "partes_otros": cuotas[1:],
        "por_cobrar_total": total - cuotas[0],
    }


def reparto_pareja(total: int, proporcion_a_bp: int) -> dict:
    """E12.2 · Gasto compartido en pareja: reparte según la proporción de A (bp); A absorbe el centavo
    sobrante en caso de empate de residuos (mayor residuo, índice menor)."""
    a, b = distribuir_mayor_residuo(total, [proporcion_a_bp, 10000 - proporcion_a_bp])
    return {"parte_a": a, "parte_b": b}


def balance_pareja(gastos: list[dict]) -> dict:
    """saldo > 0: B le debe a A. Eventos vigentes (no anulados):
    gasto {total, pago: 'a'|'b', proporcion_a_bp}: si pagó A suma la parte de B; si pagó B resta la de A.
    pago {tipo: 'pago', de: 'a'|'b', monto}: saldar; si paga A suma el monto, si paga B lo resta."""
    saldo = 0
    for g in gastos:
        if g.get("anulado"):
            continue
        if g.get("tipo") == "pago":
            saldo += g["monto"] if g["de"] == "a" else -g["monto"]
            continue
        r = reparto_pareja(g["total"], g["proporcion_a_bp"])
        saldo += r["parte_b"] if g["pago"] == "a" else -r["parte_a"]
    return {"saldo": saldo, "debe": "b" if saldo > 0 else ("a" if saldo < 0 else None), "monto": abs(saldo)}


# ---------------------------------------------------------------------------
# E13 · Fiscal personal: CFDI y deducciones personales
# ---------------------------------------------------------------------------

NS_CFDI4 = "http://www.sat.gob.mx/cfd/4"
NS_TFD = "http://www.sat.gob.mx/TimbreFiscalDigital"


def decimal_a_centavos(s: str) -> int:
    """'1160.00' → 116000; hasta 6 decimales; redondeo a centavos mitad hacia arriba. Sin flotantes."""
    s = s.strip()
    neg = s.startswith("-")
    if neg:
        s = s[1:]
    entero, _, dec = s.partition(".")
    if not entero.isdigit() or (dec and not dec.isdigit()) or len(dec) > 6:
        raise ValueError(f"importe inválido: {s!r}")
    millonesimas = int(entero) * 1_000_000 + int((dec + "000000")[:6])
    c = (millonesimas + 5_000) // 10_000
    return -c if neg else c


def parsear_cfdi(xml_texto: str) -> dict:
    import xml.etree.ElementTree as ET
    raiz = ET.fromstring(xml_texto)
    if raiz.tag != f"{{{NS_CFDI4}}}Comprobante":
        return {"error": "version_no_soportada"}
    a = raiz.attrib
    emisor = raiz.find(f"{{{NS_CFDI4}}}Emisor")
    receptor = raiz.find(f"{{{NS_CFDI4}}}Receptor")
    timbre = raiz.find(f"{{{NS_CFDI4}}}Complemento/{{{NS_TFD}}}TimbreFiscalDigital")
    if timbre is None:
        return {"error": "sin_timbre"}
    iva = 0
    traslados = raiz.find(f"{{{NS_CFDI4}}}Impuestos/{{{NS_CFDI4}}}Traslados")
    if traslados is not None:
        for t in traslados.findall(f"{{{NS_CFDI4}}}Traslado"):
            if t.get("Impuesto") == "002" and t.get("Importe") is not None:
                iva += decimal_a_centavos(t.get("Importe"))
    return {
        "uuid": timbre.get("UUID").upper(),
        "fecha": a["Fecha"][:10],
        "tipo_comprobante": a["TipoDeComprobante"],
        "forma_pago": a.get("FormaPago"),
        "metodo_pago": a.get("MetodoPago"),
        "moneda": a.get("Moneda"),
        "subtotal": decimal_a_centavos(a["SubTotal"]),
        "total": decimal_a_centavos(a["Total"]),
        "iva_trasladado": iva,
        "emisor_rfc": emisor.get("Rfc"),
        "emisor_nombre": emisor.get("Nombre"),
        "receptor_rfc": receptor.get("Rfc"),
        "uso_cfdi": receptor.get("UsoCFDI"),
    }


def tope_por_regla(regla: dict, ingresos: int, uma_anual: int) -> int | None:
    topes = []
    if "umas" in regla:
        topes.append(regla["umas"] * uma_anual)
    if "porcentaje_ingresos_bp" in regla:
        topes.append(ingresos * regla["porcentaje_ingresos_bp"] // 10000)
    if "fijo" in regla:
        topes.append(regla["fijo"])
    return min(topes) if topes else None


def estimar_deducciones(cfdis: list[dict], ingresos: int, ejercicio: int, rfc: str, config: dict,
                        etiquetas: dict | None = None) -> dict:
    """E13.2. cfdis: salidas de parsear_cfdi (+ 'estatus' opcional). etiquetas por uuid:
    {lentes, beneficiario, alumno, nivel, pagado}. Montos deducibles = total pagado (IVA incluido)."""
    etiquetas = etiquetas or {}
    uma = config["uma_anual"]
    electronicas = set(config["formas_pago_electronicas"])
    usos = config["usos"]
    incluidos, excluidos = [], []
    for c in sorted(cfdis, key=lambda c: (c.get("fecha", ""), c.get("uuid") or "")):
        et = etiquetas.get(c.get("uuid"), {})
        spec = usos.get(c.get("uso_cfdi"))
        # Un PPD trae FormaPago 99 ("por definir"); al confirmar el pago, el usuario da la forma real.
        forma = et.get("forma_pago") if (c.get("metodo_pago") == "PPD" and et.get("pagado")) else c.get("forma_pago")
        if c.get("error"):
            motivo = c["error"]
        elif c["tipo_comprobante"] != "I":
            motivo = "no_es_ingreso"
        elif c["receptor_rfc"] != rfc:
            motivo = "otro_receptor"
        elif int(c["fecha"][:4]) != ejercicio:
            motivo = "otro_ejercicio"
        elif c.get("estatus") == "cancelado":
            motivo = "cancelado"
        elif c.get("moneda") not in ("MXN", None):
            motivo = "moneda_extranjera"
        elif spec is None:
            motivo = "no_deducible"
        elif c.get("metodo_pago") == "PPD" and not et.get("pagado"):
            motivo = "ppd_sin_pago"
        elif spec["requiere_pago_electronico"] and forma not in electronicas:
            motivo = "pago_en_efectivo" if forma == "01" else "forma_de_pago_no_valida"
        elif c["uso_cfdi"] == "D10" and not (et.get("alumno") and et.get("nivel") in spec["tope_por_alumno_nivel"]):
            motivo = "falta_alumno_nivel"
        else:
            motivo = None
        if motivo:
            excluidos.append({"uuid": c.get("uuid"), "motivo": motivo})
        else:
            incluidos.append(c)
    aceptado: dict[str, int] = {}
    usado_lentes: dict[str, int] = {}
    for c in incluidos:
        m = c["total"]
        et = etiquetas.get(c["uuid"], {})
        if et.get("lentes"):
            ben = et.get("beneficiario", "titular")
            disponible = max(0, config["tope_lentes_por_beneficiario"] - usado_lentes.get(ben, 0))
            m = min(m, disponible)
            usado_lentes[ben] = usado_lentes.get(ben, 0) + m
        aceptado[c["uuid"]] = m
    por_uso = {}
    for uso in sorted(usos):
        spec = usos[uso]
        cs = [c for c in incluidos if c["uso_cfdi"] == uso]
        if not cs:
            continue
        bruto = sum(c["total"] for c in cs)
        if uso == "D10":
            por_alumno: dict[str, dict] = {}
            for c in cs:
                et = etiquetas[c["uuid"]]
                al = por_alumno.setdefault(et["alumno"], {"monto": 0, "tope": 0})
                al["monto"] += aceptado[c["uuid"]]
                al["tope"] = max(al["tope"], spec["tope_por_alumno_nivel"][et["nivel"]])
            deducible = sum(min(al["monto"], al["tope"]) for al in por_alumno.values())
        else:
            suma = sum(aceptado[c["uuid"]] for c in cs)
            tope = tope_por_regla(spec.get("tope", {}), ingresos, uma)
            deducible = suma if tope is None else min(suma, tope)
        por_uso[uso] = {"cfdis": len(cs), "bruto": bruto, "deducible": deducible, "en_tope_global": spec["en_tope_global"]}
    sujeto = sum(v["deducible"] for v in por_uso.values() if v["en_tope_global"])
    fuera = sum(v["deducible"] for v in por_uso.values() if not v["en_tope_global"])
    tope_global = tope_por_regla(config["tope_global"], ingresos, uma)
    return {
        "por_uso": por_uso,
        "excluidos": excluidos,
        "sujeto_a_tope_global": sujeto,
        "tope_global": tope_global,
        "excedente_perdido": max(0, sujeto - tope_global),
        "total_deducible": min(sujeto, tope_global) + fuera,
    }


def redondear_medio_arriba(num: int, den: int) -> int:
    """num ≥ 0, den > 0: entero más cercano a num/den; .5 hacia arriba."""
    return (2 * num + den) // (2 * den)


def isr_por_tarifa(base: int, tarifa: list[dict]) -> int:
    """Tarifa en filas ascendentes {limite_inferior, cuota_fija, tasa_bp} (centavos)."""
    if base <= 0:
        return 0
    fila = [f for f in tarifa if f["limite_inferior"] <= base][-1]
    return fila["cuota_fija"] + redondear_medio_arriba((base - fila["limite_inferior"]) * fila["tasa_bp"], 10000)


def ahorro_por_deducciones(base_gravable: int, deducciones: int, tarifa: list[dict]) -> dict:
    sin = isr_por_tarifa(base_gravable, tarifa)
    con = isr_por_tarifa(max(0, base_gravable - deducciones), tarifa)
    return {"isr_sin_deducciones": sin, "isr_con_deducciones": con, "ahorro_estimado": sin - con}


# ---------------------------------------------------------------------------
# E14 · Detección de suscripciones
# ---------------------------------------------------------------------------

PERIODICIDADES = [  # (nombre, días mínimos entre cargos, máximos, cargos mínimos, cargos por año)
    ("mensual", 27, 33, 3, 12),
    ("semanal", 6, 8, 4, 52),
    ("anual", 358, 372, 2, 1),
]
TOLERANCIA_MONTO_SUSCRIPCION_BP = 1500
GRACIA_SUSCRIPCION_DIAS = 7
VENTANA_SUSCRIPCIONES_DIAS = 400
ANCLAS_SUSCRIPCION = 3


def mediana_baja(xs: list[int]) -> int:
    s = sorted(xs)
    return s[(len(s) - 1) // 2]


def _corrida(lista: list[tuple], ancla: int, mn: int, mx: int) -> list[tuple]:
    ref = lista[ancla][1]
    corrida = [lista[ancla]]
    for f, m in reversed(lista[:ancla]):
        gap = (corrida[0][0] - f).days
        if gap < mn:
            continue  # otro cargo del mismo comercio dentro del periodo: no rompe la serie
        if gap > mx:
            break
        if abs(m - ref) * 10000 > TOLERANCIA_MONTO_SUSCRIPCION_BP * ref:
            continue
        corrida.insert(0, (f, m))
    return corrida


def detectar_suscripciones(gastos: list[dict], hoy: str, catalogo: tuple = ()) -> list[dict]:
    """gastos vigentes {fecha, monto, comercio}. catalogo: comercios normalizados conocidos como suscripción
    (bastan 2 cargos mensuales)."""
    h = fecha(hoy)
    desde = h - dt.timedelta(days=VENTANA_SUSCRIPCIONES_DIAS)
    grupos: dict[str, list[tuple]] = {}
    for g in gastos:
        f = fecha(g["fecha"])
        c = normalizar_comercio(g.get("comercio"))
        if c and desde <= f <= h:
            grupos.setdefault(c, []).append((f, g["monto"]))
    out = []
    for comercio in sorted(grupos):
        lista = sorted(grupos[comercio])
        candidatos = []
        for idx, (nombre, mn, mx, minimo, factor) in enumerate(PERIODICIDADES):
            if nombre == "mensual" and comercio in catalogo:
                minimo = 2
            for k in range(1, ANCLAS_SUSCRIPCION + 1):
                if k > len(lista):
                    break
                ancla = len(lista) - k
                corrida = _corrida(lista, ancla, mn, mx)
                if len(corrida) >= minimo:
                    candidatos.append((-len(corrida), idx, k, nombre, mx, factor, corrida))
        if not candidatos:
            continue
        _, _, _, nombre, mx, factor, corrida = min(candidatos, key=lambda x: x[:3])
        fechas_c = [f for f, _ in corrida]
        ultimo = fechas_c[-1]
        activa = (h - ultimo).days <= mx + GRACIA_SUSCRIPCION_DIAS
        if nombre == "mensual":
            dia = max(f.day for f in fechas_c[-3:])
            y, m = sumar_meses(ultimo.year, ultimo.month, 1)
            proximo = con_dia(y, m, dia)
        elif nombre == "anual":
            proximo = con_dia(ultimo.year + 1, ultimo.month, ultimo.day)
        else:
            proximo = ultimo + dt.timedelta(days=7)
        monto = mediana_baja([m for _, m in corrida])
        ultimo_monto = corrida[-1][1]
        distintos = [m for _, m in corrida if m != ultimo_monto]
        anterior = distintos[-1] if distintos and distintos[-1] < ultimo_monto else None
        out.append({
            "comercio": comercio,
            "periodicidad": nombre,
            "cargos": len(corrida),
            "monto_tipico": monto,
            "ultimo_cargo": iso(ultimo),
            "proximo_cargo": iso(proximo) if activa else None,
            "costo_anual": monto * factor,
            "monto_anterior": anterior,
            "estado": "activa" if activa else "inactiva",
        })
    out.sort(key=lambda s: (s["estado"] != "activa", -s["costo_anual"], s["comercio"]))
    return out


# ---------------------------------------------------------------------------
# E15 · Impuestos del negocio (estimación)
# ---------------------------------------------------------------------------


def ajustar_cff(c: int) -> int:
    """Art. 20 CFF: de 1 a 50 centavos, al peso inferior; de 51 a 99, al superior."""
    if c < 0:
        return -ajustar_cff(-c)
    pesos, resto = divmod(c, 100)
    return (pesos + (1 if resto >= 51 else 0)) * 100


def iva_incluido(total: int, tasa_bp: int = 1600) -> int:
    """IVA contenido en un total que ya lo incluye: total·t/(1+t), al centavo más cercano."""
    return redondear_medio_arriba(total * tasa_bp, 10000 + tasa_bp)


def tasa_resico(ingresos_mes: int, tabla: list[dict]) -> tuple[int, bool]:
    for fila in tabla:
        if ingresos_mes <= fila["hasta"]:
            return fila["tasa_bp"], False
    return tabla[-1]["tasa_bp"], True


def fecha_limite_mensual(periodo: str, dia: int) -> dt.date:
    y, m = sumar_meses(int(periodo[:4]), int(periodo[5:7]), 1)
    return ajustar_fin_de_semana(con_dia(y, m, dia), "siguiente")


def impuestos_mes(e: dict, config: dict) -> dict:
    """E15.2. ventas cobradas y gastos pagados del periodo, con su IVA ya separado."""
    base = sum(v["total"] - v["iva"] for v in e["ventas"])
    if e["modo"] == "resico_pf":
        tasa_bp, excede_tabla = tasa_resico(base, config["resico_pf"]["tabla_mensual"])
    else:
        tasa_bp, excede_tabla = e["porcentaje_bp"], False
    isr = redondear_medio_arriba(base * tasa_bp, 10000)
    ret = e.get("retenciones", {})
    isr_pagar = max(0, isr - ret.get("isr", 0))
    iva_trasladado = sum(v["iva"] for v in e["ventas"])
    iva_acreditable = sum(g["iva"] for g in e["gastos"] if g.get("con_cfdi"))
    neto = iva_trasladado - ret.get("iva", 0) - iva_acreditable - e.get("saldo_favor_iva_previo", 0)
    iva_pagar = max(0, neto)
    excede_anual = (e["modo"] == "resico_pf"
                    and e.get("ingresos_acumulados_previos", 0) + base > config["resico_pf"]["limite_anual"])
    isr_aj = ajustar_cff(isr_pagar)
    iva_aj = ajustar_cff(iva_pagar)
    return {
        "periodo": e["periodo"],
        "base_isr": base,
        "tasa_bp": tasa_bp,
        "isr_causado": isr,
        "retencion_isr": ret.get("isr", 0),
        "isr_a_pagar": isr_pagar,
        "iva_trasladado": iva_trasladado,
        "iva_retenido": ret.get("iva", 0),
        "iva_acreditable": iva_acreditable,
        "iva_a_pagar": iva_pagar,
        "saldo_favor_iva": max(0, -neto),
        "isr_a_pagar_ajustado": isr_aj,
        "iva_a_pagar_ajustado": iva_aj,
        "total_a_pagar_ajustado": isr_aj + iva_aj,
        "fecha_limite": iso(fecha_limite_mensual(e["periodo"], config["dia_pago"])),
        "excede_tabla": excede_tabla,
        "excede_limite_anual": excede_anual,
    }


# ---------------------------------------------------------------------------
# E16 · Respaldo cifrado: derivación de llave
# ---------------------------------------------------------------------------


def kdf_respaldo(contrasena: str, sal_hex: str, n: int, r: int, p: int, largo: int = 32) -> str:
    import hashlib
    clave = unicodedata.normalize("NFKC", contrasena).encode("utf-8")
    return hashlib.scrypt(clave, salt=bytes.fromhex(sal_hex), n=n, r=r, p=p, dklen=largo,
                          maxmem=256 * 1024 * 1024).hex()


# ---------------------------------------------------------------------------
# Economía unitaria (PRD §10)
# ---------------------------------------------------------------------------


def economia(precio: int, periodo_meses: int, costo_var_mensual: int, iva_bp=1600, comision_bp=1500) -> dict:
    sin_iva = precio * 10000 / (10000 + iva_bp)
    neto = sin_iva * (10000 - comision_bp) / 10000
    neto_mensual = neto / periodo_meses
    margen = neto_mensual - costo_var_mensual
    return {
        "precio": precio,
        "periodo_meses": periodo_meses,
        "sin_iva": round(sin_iva),
        "neto_tienda": round(neto),
        "neto_mensual": round(neto_mensual),
        "costo_variable_mensual": costo_var_mensual,
        "margen_mensual": round(margen),
        "margen_sobre_precio_mensual_bp": round(margen * 10000 / (precio / periodo_meses)),
    }


# ---------------------------------------------------------------------------
# Construcción de vectores
# ---------------------------------------------------------------------------

TARJETA_A = {"id": "tarj_banamex_8812", "nombre": "Banamex Oro ••8812", "modo": "totalero",
             "dia_corte": 10, "dias_para_pagar": 20, "limite_credito": 3000000,
             "saldo_revolvente": 120000, "msi_no_facturado": 0}
TARJETA_B = {"id": "tarj_nu_4410", "nombre": "Nu ••4410", "modo": "totalero",
             "dia_corte": 28, "dia_limite_pago": 18, "limite_credito": 1500000,
             "saldo_revolvente": 200000, "msi_no_facturado": 0}
TARJETA_C = {"id": "tarj_bbva_1022", "nombre": "BBVA Azul ••1022", "modo": "totalero",
             "dia_corte": 31, "dias_para_pagar": 20, "limite_credito": 1000000,
             "saldo_revolvente": 290000, "msi_no_facturado": 0}

QUINCENA = {"tipo": "quincenal_15_ultimo", "ajuste": "anterior"}


def vectores_e1():
    casos = [
        ("E1-01", 10000, [1, 1, 1]),
        ("E1-02", 100000, [1, 1, 1]),
        ("E1-03", 34000, [120000, 50000, 30000, 10000]),
        ("E1-04", -100, [1, 1, 1]),
        ("E1-05", 0, [5, 3]),
        ("E1-06", 7, [0, 1, 1]),
        ("E1-07", 150000, [1, 1, 1]),
        ("E1-08", 1, [1, 1]),
    ]
    dist = [{"id": i, "total": t, "pesos": p, "esperado": distribuir_mayor_residuo(t, p)} for i, t, p in casos]
    ajustes = []
    for i, f, modo in [
        ("E1-10", "2026-10-31", "anterior"), ("E1-11", "2026-11-15", "anterior"),
        ("E1-12", "2026-10-31", "siguiente"), ("E1-13", "2026-11-15", "siguiente"),
        ("E1-14", "2026-10-15", "anterior"), ("E1-15", "2026-11-15", "ninguno"),
    ]:
        ajustes.append({"id": i, "fecha": f, "modo": modo, "esperado": iso(ajustar_fin_de_semana(fecha(f), modo))})
    dias = []
    for i, a, m, d in [("E1-20", 2027, 2, 31), ("E1-21", 2028, 2, 30), ("E1-22", 2026, 11, 31), ("E1-23", 2026, 10, 15)]:
        dias.append({"id": i, "anio": a, "mes": m, "dia": d, "esperado": iso(con_dia(a, m, d))})
    pct = [{"id": i, "exitos": x, "n": n, "esperado": porcentaje_mostrado(x, n)} for i, x, n in [
        ("E1-30", 4494, 5000), ("E1-31", 4449, 5000), ("E1-32", 3949, 5000), ("E1-33", 0, 5000),
        ("E1-34", 5000, 5000), ("E1-35", 4999, 5000), ("E1-36", 1, 5000), ("E1-37", 25, 1000)]]
    uso = [{"id": i, "num": a, "den": b, "esperado": redondear_porcentaje(a, b)} for i, a, b in [
        ("E1-40", 7066, 10000), ("E1-41", 2333, 10000), ("E1-42", 900, 10000), ("E1-43", 50, 10000)]]
    return {"distribuir_mayor_residuo": dist, "ajuste_fin_de_semana": ajustes, "con_dia_acotado": dias,
            "porcentaje_mostrado": pct, "redondear_porcentaje": uso}


def vectores_e3():
    prox = []
    for i, regla, desde, n in [
        ("E3-01", QUINCENA, "2026-10-11", 8),
        ("E3-02", {"tipo": "quincenal_15_ultimo", "ajuste": "siguiente"}, "2026-10-11", 4),
        ("E3-03", {"tipo": "quincenal_dias", "dias": [10, 25], "ajuste": "anterior"}, "2026-10-11", 4),
        ("E3-04", {"tipo": "semanal", "dia_semana": 5, "ajuste": "ninguno"}, "2026-10-11", 3),
        ("E3-05", {"tipo": "catorcenal", "ancla": "2026-10-02", "ajuste": "ninguno"}, "2026-10-11", 3),
        ("E3-06", {"tipo": "mensual", "dia": 31, "ajuste": "anterior"}, "2026-10-11", 5),
        ("E3-07", QUINCENA, "2026-11-14", 2),
        ("E3-08", {"tipo": "anual", "mes": 2, "dia": 29}, "2026-10-11", 3),
        ("E3-09", {"tipo": "anual", "mes": 10, "dia": 17, "ajuste": "siguiente"}, "2026-10-11", 2),
    ]:
        prox.append({"id": i, "regla": regla, "desde": desde, "n": n,
                     "esperado": [iso(f) for f in proximas_fechas(regla, fecha(desde), n)]})
    hz = []
    for i, desc, hoy, recibidas in [
        ("E3-10", "Normal", "2026-10-11", ["2026-09-30"]),
        ("E3-11", "Día de pago, depósito aún no llega", "2026-10-15", ["2026-09-30"]),
        ("E3-12", "Día de pago, depósito recibido", "2026-10-15", ["2026-10-15"]),
        ("E3-13", "Víspera del pago", "2026-10-14", []),
        ("E3-14", "Depósito adelantado un día: el horizonte ya es la siguiente quincena", "2026-10-14", ["2026-10-15"]),
        ("E3-15", "Depósito retrasado 1 día", "2026-10-16", []),
        ("E3-16", "Depósito retrasado más de 2 días: se pasa a la siguiente ocurrencia", "2026-10-18", []),
    ]:
        hz.append({"id": i, "descripcion": desc, "hoy": hoy, "regla": QUINCENA, "recibidas": recibidas,
                   "esperado": horizonte(fecha(hoy), QUINCENA, set(recibidas))})
    hz.append({"id": "E3-17", "descripcion": "Modo ingreso variable", "hoy": "2026-10-11", "regla": None, "recibidas": [],
               "esperado": horizonte_variable(fecha("2026-10-11"))})
    renta_anterior = [{"concepto": "renta", "monto": 450000, "regla": {"tipo": "mensual", "dia": 1, "ajuste": "anterior"}}]
    programados = [
        {"concepto": "renta", "monto": 450000, "regla": {"tipo": "mensual", "dia": 1}},
        {"concepto": "gimnasio", "monto": 59900, "regla": {"tipo": "mensual", "dia": 5}},
        {"concepto": "internet", "monto": 67400, "regla": {"tipo": "mensual", "dia": 14}},
        {"concepto": "luz", "monto": 20500, "regla": {"tipo": "mensual", "dia": 20}},
        {"concepto": "predial", "monto": 120000, "regla": {"tipo": "unica", "fecha": "2026-11-03"}},
    ]
    exp = []
    for i, desc, prog, desde, hasta in [
        ("E3-20", "Renta día 1 con ajuste 'anterior': el 1 nov 2026 es domingo y se paga el vie 30 oct", renta_anterior, "2026-10-15", "2026-10-31"),
        ("E3-21", "La misma renta no se repite en la ventana siguiente", renta_anterior, "2026-10-31", "2026-11-15"),
        ("E3-22", "Varios programados, uno de fecha única", programados, "2026-10-15", "2026-11-13"),
    ]:
        exp.append({"id": i, "descripcion": desc, "programados": prog, "desde": desde, "hasta": hasta,
                    "esperado": expandir_programados(prog, fecha(desde), fecha(hasta))})
    quincena = {"tipo": "ingreso", "fecha": "2026-10-15", "monto": 650000, "cuenta": None}
    luz = {"tipo": "egreso", "fecha": "2026-10-20", "monto": 41000, "categoria": "servicios", "variable": True}
    renta = {"tipo": "egreso", "fecha": "2026-11-01", "monto": 450000, "categoria": "vivienda", "variable": False}
    internet = {"tipo": "egreso", "fecha": "2026-10-14", "monto": 67400, "categoria": "servicios", "variable": False}
    netflix = {"tipo": "egreso", "fecha": "2026-10-14", "monto": 21900, "comercio": "NETFLIX", "variable": False}
    cob = []
    for i, desc, oc, mov in [
        ("E3-30", "Quincena depositada un día antes, monto 0.3 % menor", quincena, {"sentido": "entrada", "fecha": "2026-10-14", "monto": 648000, "cuenta": "cta_bbva"}),
        ("E3-31", "Depósito 4 días antes: fuera de ventana", quincena, {"sentido": "entrada", "fecha": "2026-10-11", "monto": 650000, "cuenta": "cta_bbva"}),
        ("E3-32", "Depósito 23 % menor: no es la quincena", quincena, {"sentido": "entrada", "fecha": "2026-10-15", "monto": 500000, "cuenta": "cta_bbva"}),
        ("E3-33", "Recibo variable de luz 6.6 % mayor", luz, {"sentido": "salida", "fecha": "2026-10-21", "monto": 43700, "cuenta": "cta_bbva", "categoria": "servicios"}),
        ("E3-34", "Renta fija con monto distinto: preguntar", renta, {"sentido": "salida", "fecha": "2026-11-01", "monto": 470000, "cuenta": "cta_bbva", "categoria": "vivienda"}),
        ("E3-35", "Mismo rubro pero 35 % menos: no cubre", internet, {"sentido": "salida", "fecha": "2026-10-14", "monto": 43700, "cuenta": "cta_bbva", "categoria": "servicios"}),
        ("E3-36", "Por comercio normalizado", netflix, {"sentido": "salida", "fecha": "2026-10-15", "monto": 21900, "cuenta": "tarj_nu_4410", "comercio": "NETFLIX.COM"}),
    ]:
        cob.append({"id": i, "descripcion": desc, "ocurrencia": oc, "movimiento": mov, "esperado": cubre_ocurrencia(oc, mov)})
    return {"proximas_fechas": prox, "horizonte": hz, "expandir_programados": exp, "cobertura": cob}


def vectores_e4():
    base = {
        "hoy": "2026-10-11",
        "fin_horizonte": "2026-10-15",
        "liquidez": 423000,
        "colchon": 20000,
        "compromisos": [
            {"concepto": "tanda", "fecha": "2026-10-13", "monto": 50000},
            {"concepto": "internet", "fecha": "2026-10-14", "monto": 67400},
            {"concepto": "renta", "fecha": "2026-10-31", "monto": 450000},
        ],
        "tarjetas": [{"id": "tarj_nu_4410", "modo": "totalero", "saldo_revolvente": 200000}],
        "cuotas_msi_no_facturadas": [],
    }
    casos = [("E4-01", "Escenario de la maqueta: $856 libres, $214 hoy", base)]

    c2 = json.loads(json.dumps(base))
    c2["liquidez"] = 300000
    casos.append(("E4-02", "Libre negativo: se muestra $0 y el faltante", c2))

    c3 = json.loads(json.dumps(base))
    c3["tarjetas"].append({"id": "tarj_bbva_1022", "modo": "plan", "saldo_revolvente": 900000,
                           "pagos_planeados": [{"fecha": "2026-10-12", "monto": 150000},
                                               {"fecha": "2026-10-27", "monto": 150000}]})
    casos.append(("E4-03", "Tarjeta en plan: solo cuenta el pago planeado dentro del horizonte", c3))

    c4 = json.loads(json.dumps(base))
    c4["compromisos"].append({"concepto": "gas vencido", "fecha": "2026-10-08", "monto": 38000})
    casos.append(("E4-04", "Compromiso vencido no pagado sí se reserva", c4))

    c5 = json.loads(json.dumps(base))
    c5["hoy"] = "2026-10-15"
    c5["fin_horizonte"] = "2026-10-18"
    c5["compromisos"] = [{"concepto": "luz", "fecha": "2026-10-15", "monto": 41000},
                         {"concepto": "agua", "fecha": "2026-10-17", "monto": 25000},
                         {"concepto": "renta", "fecha": "2026-10-31", "monto": 450000}]
    casos.append(("E4-05", "Día de pago sin depósito (E3-11): horizonte de 3 días por posible retraso", c5))

    c6 = json.loads(json.dumps(base))
    c6["cuotas_msi_no_facturadas"] = [{"plan": "msi_tv", "fecha_limite": "2026-10-14", "monto": 100000},
                                      {"plan": "msi_tv", "fecha_limite": "2026-11-14", "monto": 100000}]
    casos.append(("E4-06", "Cuota MSI aún no facturada con fecha límite dentro del horizonte", c6))

    c7 = json.loads(json.dumps(base))
    c7["tarjetas"].append({"id": "tarj_banamex_8812", "modo": "totalero", "saldo_revolvente": -1200000})
    casos.append(("E4-07", "Saldo a favor en una tarjeta (pagó de más para liquidar MSI): no crea dinero libre", c7))

    c8 = json.loads(json.dumps(base))
    c8["tarjetas"].append({"id": "tarj_bbva_1022", "modo": "plan", "saldo_revolvente": 900000, "pagos_planeados": []})
    casos.append(("E4-08", "Tarjeta en plan sin pagos planeados: se reserva completa", c8))

    c9 = json.loads(json.dumps(base))
    c9["liquidez"] += 200000
    c9["deudas_personas"] = [{"contraparte": "jefa", "monto": 200000, "apartar": True},
                             {"contraparte": "juan", "monto": 50000, "apartar": False}]
    casos.append(("E4-09", "Préstamo de una persona: el dinero prestado no se vuelve libre", c9))

    negocio = {
        "hoy": "2026-10-11",
        "fin_horizonte": "2026-11-10",
        "liquidez": 4500000,
        "colchon": 500000,
        "compromisos": [
            {"concepto": "proveedor de refrescos", "fecha": "2026-10-20", "monto": 1200000},
            {"concepto": "renta del local", "fecha": "2026-11-01", "monto": 800000},
        ],
        "tarjetas": [],
        "cuotas_msi_no_facturadas": [],
        "impuestos_estimados": 410000,  # E15-02 (septiembre, vence el 19 oct) + E15-09 (octubre en curso)
    }
    casos.append(("E4-10", "Espacio negocio (horizonte fijo de 30 días): los impuestos estimados se apartan completos", negocio))

    return [{"id": i, "descripcion": d, "entrada": e, "esperado": dinero_libre(e)} for i, d, e in casos]


def vectores_e5():
    ciclos = []
    for i, t, compra in [
        ("E5-01", TARJETA_A, "2026-10-11"),
        ("E5-02", TARJETA_A, "2026-10-10"),
        ("E5-03", TARJETA_B, "2026-10-11"),
        ("E5-04", TARJETA_B, "2026-10-29"),
        ("E5-05", TARJETA_C, "2026-10-11"),
        ("E5-06", TARJETA_C, "2026-11-14"),
        ("E5-07", TARJETA_C, "2027-02-01"),
        ("E5-08", {**TARJETA_B, "dia_corte": 31, "dia_limite_pago": 30}, "2027-01-20"),
    ]:
        ciclos.append({"id": i, "tarjeta": {k: t[k] for k in t if k in ("id", "dia_corte", "dias_para_pagar", "dia_limite_pago")},
                       "fecha_compra": compra, "esperado": dias_financiamiento(fecha(compra), t)})
    recs = []
    for i, compra, tarjetas in [
        ("E5-10", {"fecha": "2026-10-11", "monto": 150000}, [TARJETA_A, TARJETA_B, TARJETA_C]),
        ("E5-11", {"fecha": "2026-10-27", "monto": 150000}, [TARJETA_A, TARJETA_B, TARJETA_C]),
        ("E5-12", {"fecha": "2026-10-11", "monto": 2000000}, [TARJETA_A, TARJETA_B, TARJETA_C]),
        ("E5-13", {"fecha": "2026-10-11", "monto": 5000000}, [TARJETA_A, TARJETA_B, TARJETA_C]),
        ("E5-14", {"fecha": "2026-10-11", "monto": 150000},
         [{**TARJETA_A, "modo": "plan"}, TARJETA_B, TARJETA_C]),
        ("E5-15", {"fecha": "2026-10-11", "monto": 150000},
         [{**TARJETA_A, "saldo_revolvente": -50000}, TARJETA_B, TARJETA_C]),
    ]:
        r = recomendar_tarjeta(compra, tarjetas)
        recs.append({"id": i, "compra": compra, "tarjetas": [{k: t[k] for k in ("id", "modo", "saldo_revolvente")} for t in tarjetas],
                     "esperado": {"tarjeta": r["tarjeta"]["id"] if r["tarjeta"] else None,
                                  "dias": r["tarjeta"]["dias"] if r["tarjeta"] else None,
                                  "uso_bp": r["tarjeta"]["uso_bp"] if r["tarjeta"] else None,
                                  "advertencia": r["advertencia"]}})
    return {"tarjetas_fixture": [TARJETA_A, TARJETA_B, TARJETA_C], "ciclo": ciclos, "recomendacion": recs}


def vectores_e6():
    casos = []
    for i, monto, meses, compra, t, dif in [
        ("E6-01", 150000, 3, "2026-10-11", TARJETA_A, 0),
        ("E6-02", 100000, 3, "2026-10-11", TARJETA_A, 0),
        ("E6-03", 1200000, 12, "2026-11-14", TARJETA_C, 0),
        ("E6-04", 899900, 6, "2026-11-14", TARJETA_B, 0),
        ("E6-05", 300000, 3, "2026-10-11", TARJETA_A, 1),
    ]:
        cuotas = plan_msi(monto, meses, compra, t, dif)
        casos.append({"id": i, "monto": monto, "meses": meses, "fecha_compra": compra, "tarjeta": t["id"],
                      "meses_diferimiento": dif, "esperado": {"cuotas": cuotas,
                                                               "compromiso_por_mes": compromiso_msi_por_mes(cuotas)}})
    existentes = [{"id": "E6-06", "descripcion": "MSI que ya existía al dar de alta la tarjeta: faltan 7 de $1,000",
                   "mensualidad": 100000, "restantes": 7, "hoy": "2026-10-11", "tarjeta": TARJETA_A["id"],
                   "esperado": plan_msi_existente(100000, 7, "2026-10-11", TARJETA_A)}]
    cortes = []
    for i, desc, alta, hoy, procesados in [
        ("E6-07", "Tres cortes desde el alta", "2026-10-11", "2027-01-31", []),
        ("E6-08", "Uno ya procesado", "2026-10-11", "2027-01-31", ["2026-11-10"]),
        ("E6-09", "Alta el mismo día de corte: ese corte no se procesa", "2026-10-10", "2026-10-10", []),
    ]:
        cortes.append({"id": i, "descripcion": desc, "tarjeta": TARJETA_A["id"], "alta": alta, "hoy": hoy, "procesados": procesados,
                       "esperado": cortes_a_procesar(TARJETA_A, alta, hoy, set(procesados))})
    return {"planes": casos, "planes_existentes": existentes, "cortes_a_procesar": cortes}


def vectores_e7():
    hist = [
        {"categoria": "comida_fuera", "monto": 80000}, {"categoria": "comida_fuera", "monto": 40000},
        {"categoria": "antojos", "monto": 50000}, {"categoria": "transporte", "monto": 30000},
        {"categoria": "mascotas", "monto": 8000}, {"categoria": "regalos", "monto": 2000},
    ]
    casos = [
        ("E7-01", 64000, 64000, hist),
        ("E7-02", 64000, 30000, hist),
        ("E7-03", 64000, 61000, hist),
        ("E7-04", 64000, 69000, hist),
        ("E7-05", 64000, 30000, []),
        ("E7-06", 50100, 40000, [{"categoria": "a", "monto": 1}, {"categoria": "b", "monto": 1}, {"categoria": "c", "monto": 1}]),
        ("E7-07", 90000, 10000, [{"categoria": "transporte", "monto": 30000}, {"categoria": "antojos", "monto": 30000}]),
    ]
    out = [{"id": i, "saldo_contable": s, "efectivo_real": r, "historial": h, "marcados": [], "esperado": arqueo(s, r, h)}
           for i, s, r, h in casos]
    for i, s_, r, m in [("E7-08", 64000, 30000, [2500]), ("E7-09", 64000, 60000, [2500, 3000])]:
        out.append({"id": i, "saldo_contable": s_, "efectivo_real": r, "historial": hist, "marcados": m,
                    "esperado": arqueo(s_, r, hist, m)})
    caja = []
    for i, d, s_, r, m in [
        ("E7-20", "Sobra dinero en la caja: ventas en efectivo no anotadas", 150000, 420000, []),
        ("E7-21", "Falta dinero en la caja: se pregunta (¿retiro del dueño?, ¿pago del negocio?)", 150000, 120000, []),
        ("E7-22", "Cuadra exacto", 150000, 150000, []),
        ("E7-23", "Un gasto por asignar del negocio pagado con la caja se reasigna primero", 150000, 400000, [20000]),
    ]:
        caja.append({"id": i, "descripcion": d, "saldo_contable": s_, "efectivo_real": r, "marcados": m,
                     "esperado": corte_de_caja(s_, r, m)})
    return {"arqueo": out, "corte_de_caja": caja}


def historial_fijo(dias: int, consumo_por_clase: dict, inicio="2026-08-01", fechas_pago=()) -> list[dict]:
    out = []
    d = fecha(inicio)
    pagos = {fecha(f) for f in fechas_pago}
    for _ in range(dias):
        cl = clase_dia(d, pagos)
        out.append({"fecha": iso(d), "clase": cl, "consumo": consumo_por_clase[cl]})
        d += dt.timedelta(days=1)
    return out


def historial_alternado(dias: int, valores: list[int], inicio="2026-08-01") -> list[dict]:
    out = []
    d = fecha(inicio)
    for k in range(dias):
        cl = clase_dia(d, set())
        out.append({"fecha": iso(d), "clase": cl, "consumo": valores[k % len(valores)]})
        d += dt.timedelta(days=1)
    return out


def vectores_e8():
    g = mulberry32(42)
    primeros_10 = [g() for _ in range(10)]
    g2 = mulberry32(0)
    prng_cero = [g2() for _ in range(5)]
    semillas = []
    for txt in ["2026-10-11|v1", "", "a", "2026-10-15|v1"]:
        semillas.append({"texto": txt, "fnv1a32": fnv1a32(txt)})

    sims = []
    pagos_hist = ["2026-07-15", "2026-07-31", "2026-08-14", "2026-08-31", "2026-09-15", "2026-09-30"]
    h_const = historial_fijo(92, {"habil": 10000, "finde": 10000, "pago": 10000}, inicio="2026-07-01", fechas_pago=pagos_hist)
    h1 = [{"inicio": "2026-10-11", "fin": "2026-10-15", "ingreso": 0, "compromisos": 0}]
    sims.append(("E8-01", "Consumo constante $100/día, 4 días, excedente $400: siempre llega",
                 {"historial": h_const, "horizontes": h1, "excedente_inicial": 40000, "n": 2000, "semilla": 7},
                 {"probabilidad_analitica": 1.0}))
    sims.append(("E8-02", "Igual que E8-01 con 1 centavo menos: nunca llega",
                 {"historial": h_const, "horizontes": h1, "excedente_inicial": 39999, "n": 2000, "semilla": 7},
                 {"probabilidad_analitica": 0.0}))

    h_dos = historial_alternado(60, [0, 20000])
    h2d = [{"inicio": "2026-10-12", "fin": "2026-10-14", "ingreso": 0, "compromisos": 0}]
    sims.append(("E8-03", "Días de $0 o $200 al 50 %; 2 días; excedente $200: P analítica 0.75",
                 {"historial": h_dos, "horizontes": h2d, "excedente_inicial": 20000, "n": 10000, "semilla": 42},
                 {"probabilidad_analitica": 0.75, "tolerancia": 0.02}))

    h_clases = historial_fijo(92, {"habil": 5000, "finde": 20000, "pago": 50000}, inicio="2026-07-01", fechas_pago=pagos_hist)
    hjd = [{"inicio": "2026-10-15", "fin": "2026-10-19", "ingreso": 0, "compromisos": 0}]
    sims.append(("E8-04", "Clases de día: jue+vie hábil ($50) y sáb+dom finde ($200) = $500 exactos",
                 {"historial": h_clases, "horizontes": hjd, "excedente_inicial": 50000, "n": 1000, "semilla": 1},
                 {"probabilidad_analitica": 1.0}))
    sims.append(("E8-05", "Igual que E8-04 con 1 centavo menos",
                 {"historial": h_clases, "horizontes": hjd, "excedente_inicial": 49999, "n": 1000, "semilla": 1},
                 {"probabilidad_analitica": 0.0}))

    h_multi = [
        {"inicio": "2026-10-11", "fin": "2026-10-15", "ingreso": 0, "compromisos": 0},
        {"inicio": "2026-10-15", "fin": "2026-10-30", "ingreso": 800000, "compromisos": 450000},
    ]
    sims.append(("E8-06", "Dos horizontes con ingreso y renta; el día de pago usa la clase 'pago' ($500)",
                 {"historial": h_clases, "horizontes": h_multi, "excedente_inicial": 150000, "n": 1000, "semilla": 3},
                 {"probabilidad_analitica": 1.0}))
    h_multi_b = json.loads(json.dumps(h_multi))
    h_multi_b[1]["compromisos"] = 800000
    sims.append(("E8-06b", "Igual que E8-06 pero los compromisos del 2.º horizonte consumen todo el ingreso",
                 {"historial": h_clases, "horizontes": h_multi_b, "excedente_inicial": 150000, "n": 1000, "semilla": 3},
                 {"probabilidad_analitica": 0.0}))

    h_pocos = historial_fijo(20, {"habil": 10000, "finde": 30000, "pago": 99999}, inicio="2026-09-01")
    sims.append(("E8-07", "Clase 'pago' con < 5 días cae al pool 'todos'",
                 {"historial": h_pocos, "horizontes": [{"inicio": "2026-10-11", "fin": "2026-10-12", "ingreso": 0, "compromisos": 0}],
                  "excedente_inicial": 20000, "n": 10000, "semilla": 11, "hoy_es_dia_de_pago": True},
                 {"probabilidad_analitica": 0.7, "tolerancia": 0.02}))

    sims.append(("E8-08", "Menos de 14 días de historial",
                 {"historial": h_const[:13], "horizontes": h1, "excedente_inicial": 40000, "n": 100, "semilla": 1},
                 {"probabilidad_analitica": None}))


    # --- Historial para la simulación ---
    txs = [
        {"fecha": "2026-09-28", "tipo": "gasto", "monto_gasto": 12000},
        {"fecha": "2026-09-30", "tipo": "gasto", "monto_gasto": 30000},
        {"fecha": "2026-10-01", "tipo": "transferencia", "monto_gasto": 0},
        {"fecha": "2026-10-02", "tipo": "pago_tarjeta", "monto_gasto": 0},
        {"fecha": "2026-10-03", "tipo": "compra_msi", "monto_gasto": 1200000},
        {"fecha": "2026-10-03", "tipo": "gasto", "monto_gasto": 21900, "cubre_ocurrencia": True},
        {"fecha": "2026-10-04", "tipo": "gasto", "monto_gasto": 900000, "extraordinaria": True},
        {"fecha": "2026-10-05", "tipo": "cuenta_dividida", "monto_gasto": 30000},
        {"fecha": "2026-10-06", "tipo": "reembolso", "monto_gasto": -19900},
        {"fecha": "2026-10-06", "tipo": "gasto", "monto_gasto": 5000},
        {"fecha": "2026-10-08", "tipo": "ajuste_arqueo", "monto_gasto": 34000, "arqueo_anterior": "2026-10-04"},
        {"fecha": "2026-10-10", "tipo": "gasto", "monto_gasto": 7000},
        {"fecha": "2026-10-11", "tipo": "gasto", "monto_gasto": 5000},
    ]
    historial_vec = {"id": "E8-30", "descripcion": "Constructor de historial: exclusiones, reparto del arqueo y días en 0",
                     "transacciones": txs, "inicio_uso": "2026-09-28", "hoy": "2026-10-11", "fechas_ingreso": ["2026-09-30"],
                     "esperado": construir_historial(txs, "2026-09-28", "2026-10-11", ["2026-09-30"])}

    # --- Escenarios de compra ---
    programados = [
        {"concepto": "renta", "monto": 450000, "regla": {"tipo": "mensual", "dia": 1}},
        {"concepto": "gimnasio", "monto": 59900, "regla": {"tipo": "mensual", "dia": 5}},
        {"concepto": "internet", "monto": 67400, "regla": {"tipo": "mensual", "dia": 14}},
        {"concepto": "luz", "monto": 20500, "regla": {"tipo": "mensual", "dia": 20}},
    ]
    hz = construir_horizontes("2026-10-11", QUINCENA, 650000, programados, "2027-02-15", {"2026-09-30"})
    historial_real = []
    d = fecha("2026-07-01")
    ciclos = {"habil": [12000, 0, 8500, 23000, 4000, 15000, 6000], "finde": [35000, 18000, 52000, 0], "pago": [60000, 90000]}
    idx = {"habil": 0, "finde": 0, "pago": 0}
    pagos_set = {fecha(f) for f in pagos_hist}
    for _ in range(92):
        cl = clase_dia(d, pagos_set)
        historial_real.append({"fecha": iso(d), "clase": cl, "consumo": ciclos[cl][idx[cl] % len(ciclos[cl])]})
        idx[cl] += 1
        d += dt.timedelta(days=1)
    tarjeta_oro_sin_saldo = {**TARJETA_A, "saldo_revolvente": 0}
    gen = generar_escenarios(150000, "2026-10-11", "2026-10-15", [tarjeta_oro_sin_saldo])
    entrada_comparar = {"hoy": "2026-10-11", "excedente_inicial": 85600, "regla_ingreso": QUINCENA, "monto_ingreso": 650000,
                        "programados": programados, "recibidas": ["2026-09-30"], "tarjetas": [tarjeta_oro_sin_saldo],
                        "historial": historial_real, "escenarios": gen["escenarios"], "semilla": fnv1a32("2026-10-11|v1")}
    comp = comparar_escenarios(entrada_comparar)
    generacion = []
    for i, desc, precio, meses, f_compra in [
        ("E8-23a", "Sin meses: se ofrece 3 MSI con la tarjeta recomendada", 150000, None, None),
        ("E8-23b", "Pidió 12 meses: tarjeta con uso alto", 1200000, 12, None),
        ("E8-23c", "Menos de $1,000 y sin meses: no hay escenario MSI", 50000, None, None),
        ("E8-23d", "Fecha dicha por el usuario para esperar", 800000, None, "2026-10-16"),
        ("E8-23e", "Ninguna tarjeta tiene espacio", 5000000, None, None),
    ]:
        generacion.append({"id": i, "descripcion": desc, "precio": precio, "meses": meses, "fecha_compra": f_compra,
                           "hoy": "2026-10-11", "proximo_ingreso": "2026-10-15", "tarjetas": [TARJETA_A, TARJETA_B, TARJETA_C],
                           "esperado": generar_escenarios(precio, "2026-10-11", "2026-10-15", [TARJETA_A, TARJETA_B, TARJETA_C], meses, f_compra)})
    escenario_vectores = {
        "E8-21_construir_horizontes": {"id": "E8-21", "hoy": "2026-10-11", "regla_ingreso": QUINCENA, "monto_ingreso": 650000,
                                       "programados": programados, "hasta": "2027-02-15", "recibidas": ["2026-09-30"], "esperado": hz},
        "E8-22_comparar_escenarios": {"id": "E8-22", "entrada": entrada_comparar, "esperado": comp},
        "E8-23_generar_escenarios": generacion,
    }
    out = []
    for i, desc, e, extra in sims:
        r = simular(e)
        out.append({"id": i, "descripcion": desc, "entrada": e, "esperado": r, **extra})
    return {"mulberry32": {"semilla_42_primeros_10": primeros_10, "semilla_0_primeros_5": prng_cero},
            "fnv1a32": semillas, "simulacion": out, "historial": historial_vec, "escenarios": escenario_vectores}


def vectores_e9():
    norm = []
    for i, s in [
        ("E9-01", "OXXO PUEBLA 1234 S.A. DE C.V."), ("E9-02", "Café Tacuba"),
        ("E9-03", "UBER *TRIP HELP.UBER.COM"), ("E9-04", "PEMEX ES 4567"),
        ("E9-05", "  wal-mart   sucursal 2231 "), ("E9-06", None), ("E9-07", "Pago en TIENDA OXXO"),
    ]:
        norm.append({"id": i, "entrada": s, "esperado": normalizar_comercio(s)})
    jw = []
    for i, a, b in [
        ("E9-10", "MARTHA", "MARHTA"), ("E9-11", "DWAYNE", "DUANE"), ("E9-12", "DIXON", "DICKSONX"),
        ("E9-13", "OXXO", "OXXO PUEBLA CENTRO"), ("E9-14", "WALMART", "WAL MART"),
        ("E9-15", "SORIANA", "CHEDRAUI"), ("E9-16", "ABC", "XYZ"), ("E9-17", "TAQUERIA", "TAQUERIA"),
    ]:
        jw.append({"id": i, "a": a, "b": b, "jaro": round(jaro(a, b), 6), "jaro_winkler": round(jaro_winkler(a, b), 6)})
    sim = []
    for i, a, b in [("E9-20", "OXXO", "OXXO PUEBLA CENTRO"), ("E9-21", "WAL MART", "WALMART SUPERCENTER"),
                    ("E9-22", "SORIANA", "CHEDRAUI"), ("E9-23", "", "OXXO")]:
        sim.append({"id": i, "a": a, "b": b, "esperado": round(similitud(a, b), 6)})
    dd = []
    base = {"cuenta": "tarj_bbva_1022", "monto": 25000}
    for i, desc, cap, mov in [
        ("E9-30", "Manual sin comercio, mismo día", {**base, "fecha": "2026-10-11", "comercio": "OXXO PUEBLA 123"},
         {**base, "fecha": "2026-10-11", "comercio": None}),
        ("E9-31", "Manual sin comercio, 2 días", {**base, "fecha": "2026-10-13", "comercio": "OXXO"},
         {**base, "fecha": "2026-10-11", "comercio": None}),
        ("E9-32", "Monto distinto", {**base, "monto": 25100, "fecha": "2026-10-11", "comercio": "OXXO"},
         {**base, "fecha": "2026-10-11", "comercio": None}),
        ("E9-33", "Cuenta distinta", {**base, "cuenta": "efectivo", "fecha": "2026-10-11", "comercio": "OXXO"},
         {**base, "fecha": "2026-10-11", "comercio": None}),
        ("E9-34", "Notificación vs estado de cuenta, comercio contenido", {**base, "fecha": "2026-10-12", "comercio": "OXXO PUEBLA CENTRO 4410"},
         {**base, "fecha": "2026-10-11", "comercio": "OXXO"}),
        ("E9-35", "Comercios parecidos a 2 días", {**base, "fecha": "2026-10-13", "comercio": "WALMART SUPERCENTER"},
         {**base, "fecha": "2026-10-11", "comercio": "WAL MART"}),
        ("E9-36", "Comercios distintos mismo día", {**base, "fecha": "2026-10-11", "comercio": "SORIANA"},
         {**base, "fecha": "2026-10-11", "comercio": "CHEDRAUI"}),
        ("E9-37", "Manual sin comercio, 3 días", {**base, "fecha": "2026-10-14", "comercio": "OXXO"},
         {**base, "fecha": "2026-10-11", "comercio": None}),
        ("E9-38", "Dictado sin método (por asignar) + cargo con tarjeta el mismo día",
         {"cuenta": "tarj_nu_4410", "monto": 2500, "fecha": "2026-10-11", "comercio": "OXXO"},
         {"cuenta": "por_asignar", "monto": 2500, "fecha": "2026-10-11", "comercio": None}),
        ("E9-39", "Por asignar a 2 días",
         {"cuenta": "tarj_nu_4410", "monto": 2500, "fecha": "2026-10-13", "comercio": "OXXO"},
         {"cuenta": "por_asignar", "monto": 2500, "fecha": "2026-10-11", "comercio": None}),
        ("E9-40", "Compra a MSI dictada (subcuenta) + notificación del cargo completo en la tarjeta",
         {"cuenta": "tarj_banamex_8812", "monto": 1200000, "fecha": "2026-11-14", "comercio": "LIVERPOOL"},
         {"cuenta": "tarj_banamex_8812:msi:plan_tv", "cuenta_raiz": "tarj_banamex_8812", "monto": 1200000, "fecha": "2026-11-14", "comercio": None, "tipo": "compra_msi"}),
        ("E9-41", "Quincena dictada ($8,000) y depósito real ($7,850): preguntar",
         {"cuenta": "cta_bbva", "monto": 785000, "fecha": "2026-10-15", "comercio": None, "sentido": "entrada"},
         {"cuenta": "por_asignar_entradas", "monto": 800000, "fecha": "2026-10-15", "comercio": None, "tipo": "ingreso"}),
        ("E9-42", "Depósito 25 % distinto: nuevo",
         {"cuenta": "cta_bbva", "monto": 600000, "fecha": "2026-10-15", "comercio": None, "sentido": "entrada"},
         {"cuenta": "por_asignar_entradas", "monto": 800000, "fecha": "2026-10-15", "comercio": None, "tipo": "ingreso"}),
        ("E9-43", "Depósito exacto de un ingreso dictado: fusionar",
         {"cuenta": "cta_bbva", "monto": 800000, "fecha": "2026-10-15", "comercio": None, "sentido": "entrada"},
         {"cuenta": "por_asignar_entradas", "monto": 800000, "fecha": "2026-10-15", "comercio": None, "tipo": "ingreso"}),
    ]:
        dd.append({"id": i, "descripcion": desc, "captura": cap, "movimiento": mov, "esperado": decidir_duplicado(cap, mov)})
    sal = [
        {"id": "s1", "cuenta": "cta_bbva", "monto": 420000, "fecha": "2026-10-11", "tipo": "transferencia_enviada"},
        {"id": "s2", "cuenta": "cta_bbva", "monto": 200000, "fecha": "2026-10-11", "tipo": "transferencia_enviada"},
        {"id": "s3", "cuenta": "cta_bbva", "monto": 30000, "fecha": "2026-10-11", "tipo": "transferencia_enviada"},
        {"id": "s4", "cuenta": "cta_bbva", "monto": 50000, "fecha": "2026-10-10", "tipo": "transferencia_enviada"},
        {"id": "s5", "cuenta": "cta_bbva", "monto": 50000, "fecha": "2026-10-11", "tipo": "transferencia_enviada"},
    ]
    ent = [
        {"id": "e1", "cuenta": "tarj_banamex_8812", "monto": 420000, "fecha": "2026-10-12", "tipo": "pago_recibido_tarjeta"},
        {"id": "e2", "cuenta": "cta_mercado_pago", "monto": 200000, "fecha": "2026-10-11", "tipo": "transferencia_recibida"},
        {"id": "e3", "cuenta": "cta_mercado_pago", "monto": 30000, "fecha": "2026-10-14", "tipo": "transferencia_recibida"},
        {"id": "e4", "cuenta": "cta_mercado_pago", "monto": 50000, "fecha": "2026-10-11", "tipo": "transferencia_recibida"},
    ]
    emp = {"salidas": sal, "entradas": ent, "esperado": emparejar_transferencias(sal, ent)}
    sal2 = [{"id": "s9", "cuenta": "cta_bbva", "monto": 200000, "fecha": "2026-10-11", "tipo": "transferencia_enviada"}]
    ent2 = [{"id": "e9", "cuenta": "cta_mercado_pago", "monto": 200000, "fecha": "2026-10-11", "tipo": "transferencia_recibida",
             "ya_registrada": True}]
    emp2 = {"descripcion": "La entrada llegó primero y ya se registró como ingreso: se reemplaza por la transferencia",
            "salidas": sal2, "entradas": ent2, "esperado": emparejar_transferencias(sal2, ent2)}
    sal3 = [
        {"id": "s20", "cuenta": "cta_banorte_negocio", "espacio": "negocio", "monto": 800000, "fecha": "2026-10-15",
         "tipo": "transferencia_enviada"},
        {"id": "s21", "cuenta": "cta_bbva", "espacio": "personal", "monto": 150000, "fecha": "2026-10-15",
         "tipo": "transferencia_enviada"},
        {"id": "s22", "cuenta": "cta_bbva", "espacio": "personal", "monto": 300000, "fecha": "2026-10-15",
         "tipo": "transferencia_enviada"},
    ]
    ent3 = [
        {"id": "e20", "cuenta": "cta_bbva", "espacio": "personal", "monto": 800000, "fecha": "2026-10-15",
         "tipo": "transferencia_recibida", "ya_registrada": True},
        {"id": "e21", "cuenta": "tarj_negocio_3301", "espacio": "negocio", "monto": 150000, "fecha": "2026-10-15",
         "tipo": "pago_recibido_tarjeta"},
        {"id": "e22", "cuenta": "cta_banorte_negocio", "espacio": "negocio", "monto": 300000, "fecha": "2026-10-16",
         "tipo": "transferencia_recibida"},
    ]
    emp3 = {"id": "E9-50",
            "descripcion": "Pares entre espacios: sueldo del dueño (negocio → personal, la entrada ya cubría la quincena), "
                           "pago de la tarjeta del negocio desde la cuenta personal y aportación al negocio",
            "salidas": sal3, "entradas": ent3, "esperado": emparejar_transferencias(sal3, ent3)}
    sal4 = [{"id": "s30", "cuenta": "cta_banorte_negocio", "espacio": "negocio", "monto": 800000, "fecha": "2026-10-15",
             "tipo": "transferencia_enviada", "ya_registrada": True}]
    ent4 = [{"id": "e30", "cuenta": "cta_bbva", "espacio": "personal", "monto": 800000, "fecha": "2026-10-15",
             "tipo": "transferencia_recibida"}]
    emp4 = {"id": "E9-51",
            "descripcion": "Sueldo del dueño con la salida del negocio registrada primero (tránsito): el par reemplaza la "
                           "salida por un retiro_dueno y después E3.5 corre con la entrada personal (cubre la quincena)",
            "salidas": sal4, "entradas": ent4, "esperado": emparejar_transferencias(sal4, ent4)}
    return {"normalizar_comercio": norm, "jaro_winkler": jw, "similitud": sim, "decision": dd,
            "emparejar_transferencias": emp, "emparejar_entrada_primero": emp2, "emparejar_entre_espacios": emp3,
            "emparejar_entre_espacios_salida_primero": emp4}


def vectores_e10():
    casos = [
        ("E10-01", {"ingreso_mensual_neto": 2000000, "pagos_deuda_mensuales": 300000, "pagos_msi_mensuales": 100000,
                    "compra": {"precio": 1200000, "meses": 12}}),
        ("E10-02", {"ingreso_mensual_neto": 2000000, "pagos_deuda_mensuales": 550000, "pagos_msi_mensuales": 0,
                    "compra": {"precio": 1200000, "meses": 12}}),
        ("E10-03", {"ingreso_mensual_neto": 1500000, "pagos_deuda_mensuales": 500000, "pagos_msi_mensuales": 200000,
                    "compra": {"precio": 600000, "meses": 6}}),
        ("E10-04", {"ingreso_mensual_neto": 1234567, "pagos_deuda_mensuales": 0, "pagos_msi_mensuales": 0,
                    "compra": {"precio": 100000, "meses": 3}}),
    ]
    return [{"id": i, "entrada": e, "esperado": capacidad(e)} for i, e in casos]


def vectores_e11():
    regla = {"tipo": "semanal", "dia_semana": 5, "ajuste": "ninguno"}
    return [{"id": "E11-01", "aportacion": 50000, "participantes": 10, "turno": 4, "regla": regla,
             "inicio": "2026-10-16", "esperado": tanda(50000, 10, 4, regla, "2026-10-16")},
            {"id": "E11-02", "aportacion": 100000, "participantes": 5, "turno": 1, "regla": QUINCENA,
             "inicio": "2026-10-15", "esperado": tanda(100000, 5, 1, QUINCENA, "2026-10-15")},
            {"id": "E11-03", "descripcion": "Tanda que ya existía: empezó el vie 4 sep, ya se hicieron 6 aportaciones "
                                            "y ya cobraste (turno 4); debes 4 aportaciones",
             "aportacion": 50000, "participantes": 10, "turno": 4, "regla": regla, "inicio": "2026-09-04",
             "hoy": "2026-10-11", "esperado": tanda_existente(50000, 10, 4, regla, "2026-09-04", "2026-10-11")}]


def vectores_e12():
    dividir = [{"id": i, "total": t, "partes": p, "esperado": dividir_cuenta(t, p)}
               for i, t, p in [("E12-01", 120000, 4), ("E12-02", 100000, 3), ("E12-03", 99999, 2), ("E12-04", 5, 3)]]
    reparto = [{"id": i, "total": t, "proporcion_a_bp": bp, "esperado": reparto_pareja(t, bp)}
               for i, t, bp in [("E12-10", 120000, 5000), ("E12-11", 100100, 6000), ("E12-12", 99999, 5000),
                                ("E12-13", 45000, 10000)]]
    gastos = [
        {"id": "g1", "total": 120000, "pago": "a", "proporcion_a_bp": 5000},
        {"id": "g2", "total": 450000, "pago": "b", "proporcion_a_bp": 6000},
        {"id": "g3", "total": 99999, "pago": "a", "proporcion_a_bp": 5000},
        {"id": "g4", "total": 30000, "pago": "b", "proporcion_a_bp": 5000, "anulado": True},
    ]
    con_pagos = gastos + [{"id": "p1", "tipo": "pago", "de": "a", "monto": 100000},
                          {"id": "p2", "tipo": "pago", "de": "a", "monto": 60001}]
    balance = [{"id": "E12-20", "gastos": gastos, "esperado": balance_pareja(gastos)},
               {"id": "E12-21", "descripcion": "A salda su deuda en dos pagos: el saldo queda en cero",
                "gastos": con_pagos, "esperado": balance_pareja(con_pagos)}]
    return {"dividir_cuenta": dividir, "reparto_pareja": reparto, "balance_pareja": balance}


CONFIG_FISCAL_PRUEBA = {
    "descripcion": "Parámetros SINTÉTICOS para probar la lógica de E13. Los valores reales por ejercicio viven en "
                   "config/fiscal/<año>.json y los valida un contador público.",
    "uma_anual": 4279464,
    "tope_global": {"umas": 5, "porcentaje_ingresos_bp": 1500},
    "formas_pago_electronicas": ["02", "03", "04", "28", "29"],
    "tope_lentes_por_beneficiario": 250000,
    "usos": {
        "D01": {"en_tope_global": True, "requiere_pago_electronico": True},
        "D02": {"en_tope_global": False, "requiere_pago_electronico": True},
        "D03": {"en_tope_global": True, "requiere_pago_electronico": False, "tope": {"umas": 1}},
        "D04": {"en_tope_global": False, "requiere_pago_electronico": False, "tope": {"porcentaje_ingresos_bp": 700}},
        "D05": {"en_tope_global": True, "requiere_pago_electronico": False},
        "D06": {"en_tope_global": False, "requiere_pago_electronico": False,
                "tope": {"porcentaje_ingresos_bp": 1000, "umas": 5}},
        "D07": {"en_tope_global": True, "requiere_pago_electronico": False},
        "D08": {"en_tope_global": True, "requiere_pago_electronico": True},
        "D09": {"en_tope_global": False, "requiere_pago_electronico": False, "tope": {"fijo": 15200000}},
        "D10": {"en_tope_global": False, "requiere_pago_electronico": True,
                "tope_por_alumno_nivel": {"preescolar": 1420000, "primaria": 1290000, "secundaria": 1990000,
                                          "profesional_tecnico": 1710000, "bachillerato": 2450000}},
    },
}

TARIFA_PRUEBA = [  # SINTÉTICA: misma forma que la tarifa anual del art. 152 LISR, otros números
    {"limite_inferior": 0, "cuota_fija": 0, "tasa_bp": 192},
    {"limite_inferior": 1000000, "cuota_fija": 19200, "tasa_bp": 640},
    {"limite_inferior": 10000000, "cuota_fija": 595200, "tasa_bp": 1088},
    {"limite_inferior": 50000000, "cuota_fija": 4947200, "tasa_bp": 3000},
]


def vectores_e13():
    import os
    carpeta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cfdi")
    parseados = {}
    parsear = []
    for nombre in sorted(os.listdir(carpeta)):
        if not nombre.endswith(".xml"):
            continue
        with open(os.path.join(carpeta, nombre), encoding="utf-8") as fh:
            r = parsear_cfdi(fh.read())
        parseados[nombre] = r
        parsear.append({"archivo": f"fixtures/cfdi/{nombre}", "esperado": r})
    validos = [n for n in sorted(parseados) if "error" not in parseados[n]]  # un XML inválido no se importa
    cfdis = [parseados[n] for n in validos]
    etiquetas = {
        "5A1B2C3D-0000-4000-8000-000000000003": {"lentes": True, "beneficiario": "titular"},
        "5A1B2C3D-0000-4000-8000-000000000004": {"alumno": "ana", "nivel": "primaria"},
        "5A1B2C3D-0000-4000-8000-000000000005": {"alumno": "ana", "nivel": "primaria"},
    }
    deducciones = []
    etiquetas_ppd = dict(etiquetas)
    etiquetas_ppd["5A1B2C3D-0000-4000-8000-000000000008"] = {"pagado": True, "forma_pago": "03"}
    for i, d, ingresos, et in [
        ("E13-10", "Ingresos de $300,000: no se llega al tope global", 30000000, etiquetas),
        ("E13-11", "Ingresos de $60,000: el 15 % recorta lo sujeto a tope global", 6000000, etiquetas),
        ("E13-12", "Como E13-10, pero el usuario confirmó el pago del hospital (PPD) por transferencia", 30000000,
         etiquetas_ppd),
    ]:
        deducciones.append({"id": i, "descripcion": d, "ejercicio": 2026, "rfc": "PEPJ800101AB1",
                            "ingresos": ingresos, "etiquetas": et,
                            "cfdis": [f"fixtures/cfdi/{n}" for n in validos],
                            "esperado": estimar_deducciones(cfdis, ingresos, 2026, "PEPJ800101AB1",
                                                            CONFIG_FISCAL_PRUEBA, et)})
    ahorro = [{"id": i, "base_gravable": b, "deducciones": dd, "esperado": ahorro_por_deducciones(b, dd, TARIFA_PRUEBA)}
              for i, b, dd in [("E13-20", 30000000, 2590000), ("E13-21", 6000000, 2190000), ("E13-22", 800000, 2000000)]]
    isr_tarifa = [{"base": b, "esperado": isr_por_tarifa(b, TARIFA_PRUEBA)} for b in [0, 999999, 1000000, 1000010, 1000078]]
    montos = [{"entrada": s, "esperado": decimal_a_centavos(s)}
              for s in ["1160.00", "1160", "0.005", "0.004999", "13.793103", "2758.62"]]
    return {"config_prueba": CONFIG_FISCAL_PRUEBA, "tarifa_prueba": TARIFA_PRUEBA, "decimal_a_centavos": montos,
            "parsear": parsear, "deducciones": deducciones, "isr_por_tarifa": isr_tarifa, "ahorro": ahorro}


def vectores_e14():
    g = []

    def agrega(comercio, monto, *fechas):
        for f in fechas:
            g.append({"fecha": f, "monto": monto, "comercio": comercio})

    agrega("NETFLIX", 21900, "2026-07-14", "2026-08-14", "2026-09-14")
    agrega("NETFLIX", 4900, "2026-10-10")  # renta de una película: no rompe la suscripción
    agrega("SPOTIFY", 11500, "2026-06-05")
    agrega("SPOTIFY", 12900, "2026-07-05", "2026-08-05", "2026-09-05", "2026-10-05")
    agrega("SMART FIT", 59900, "2026-08-01", "2026-09-01", "2026-10-01")
    agrega("ESTUDIO YOGA", 15000, "2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25", "2026-10-02", "2026-10-09")
    agrega("DOMINIO WEB MX", 35000, "2025-10-08", "2026-10-08")
    agrega("DISNEY PLUS", 15900, "2026-04-20", "2026-05-20", "2026-06-20", "2026-07-20")
    for f, m in [("2026-09-01", 4500), ("2026-09-03", 2500), ("2026-09-10", 6000), ("2026-09-28", 3000),
                 ("2026-10-02", 2500), ("2026-10-09", 8000)]:
        g.append({"fecha": f, "monto": m, "comercio": "OXXO PUEBLA 123"})
    agrega("ICLOUD", 1900, "2026-09-12", "2026-10-12")  # fuera: posterior a hoy (2026-10-11)
    agrega("ICLOUD", 1900, "2026-08-12", "2026-09-11")
    g.sort(key=lambda x: (x["fecha"], x["comercio"], x["monto"]))
    g3 = [{"fecha": f, "monto": m, "comercio": "GIMNASIO CENTRO"} for f, m in [
        ("2026-07-01", 50000), ("2026-08-01", 50000), ("2026-08-03", 9000), ("2026-09-01", 50000), ("2026-10-01", 50000)]]
    activas = [x for x in detectar_suscripciones(g, "2026-10-11") if x["estado"] == "activa"]
    return [
        {"id": "E14-01", "hoy": "2026-10-11", "catalogo": [], "gastos": g,
         "esperado": detectar_suscripciones(g, "2026-10-11"),
         "resumen_activas": {"cantidad": len(activas), "costo_anual": sum(x["costo_anual"] for x in activas),
                             "mensual": sum(x["costo_anual"] for x in activas) // 12}},
        {"id": "E14-03", "descripcion": "Un cargo de otro monto a 29 días (inscripción de $90) en medio de la serie: "
                                        "se salta, no corta; los días se miden desde el último cargo aceptado",
         "hoy": "2026-10-11", "catalogo": [], "gastos": g3, "esperado": detectar_suscripciones(g3, "2026-10-11")},
        {"id": "E14-02", "descripcion": "Con ICLOUD en el catálogo semilla de suscripciones bastan 2 cargos mensuales",
         "hoy": "2026-10-11", "catalogo": ["ICLOUD"], "gastos": g,
         "esperado": detectar_suscripciones(g, "2026-10-11", ("ICLOUD",))},
    ]


CONFIG_IMPUESTOS_2026 = {
    "descripcion": "Tabla de pagos mensuales RESICO personas físicas (LISR art. 113-E) y día de pago. "
                   "POR VALIDAR por contador público antes de M11; los vectores prueban la lógica con estos valores.",
    "dia_pago": 17,
    "iva_tasa_general_bp": 1600,
    "porcentaje_por_defecto_bp": 2000,
    "resico_pf": {
        "limite_anual": 350000000,
        "tabla_mensual": [
            {"hasta": 2500000, "tasa_bp": 100},
            {"hasta": 5000000, "tasa_bp": 110},
            {"hasta": 8333333, "tasa_bp": 150},
            {"hasta": 20833333, "tasa_bp": 200},
            {"hasta": 350000000, "tasa_bp": 250},
        ],
    },
}


def vectores_e15():
    c = CONFIG_IMPUESTOS_2026
    casos = [
        ("E15-01", "Freelance RESICO con IVA y retenciones de una persona moral: la retención cubre el ISR",
         {"periodo": "2026-09", "modo": "resico_pf",
          "ventas": [{"total": 3480000, "iva": 480000}],
          "gastos": [{"total": 435000, "iva": 60000, "con_cfdi": True}, {"total": 20000, "iva": 2759, "con_cfdi": False}],
          "retenciones": {"isr": 37500, "iva": 320000}, "saldo_favor_iva_previo": 0, "ingresos_acumulados_previos": 24000000}),
        ("E15-02", "Tienda con ventas a tasa 0 %: solo ISR; el 17 de octubre de 2026 es sábado → lunes 19",
         {"periodo": "2026-09", "modo": "resico_pf",
          "ventas": [{"total": 6000000, "iva": 0}], "gastos": [], "retenciones": {},
          "saldo_favor_iva_previo": 0, "ingresos_acumulados_previos": 0}),
        ("E15-03", "Porcentaje fijo indicado por el contador (10 %)",
         {"periodo": "2026-10", "modo": "porcentaje", "porcentaje_bp": 1000,
          "ventas": [{"total": 4500000, "iva": 0}], "gastos": [], "retenciones": {}}),
        ("E15-04", "IVA a favor: no se paga y se arrastra",
         {"periodo": "2026-08", "modo": "resico_pf",
          "ventas": [{"total": 1160000, "iva": 160000}],
          "gastos": [{"total": 1740000, "iva": 240000, "con_cfdi": True}], "retenciones": {}}),
        ("E15-05", "Mes siguiente con el saldo a favor de E15-04",
         {"periodo": "2026-09", "modo": "resico_pf",
          "ventas": [{"total": 2320000, "iva": 320000}],
          "gastos": [{"total": 290000, "iva": 40000, "con_cfdi": True}], "retenciones": {},
          "saldo_favor_iva_previo": 80000}),
        ("E15-06", "Frontera de tabla: $25,000.00 exactos → 1.00 %; ajuste a pesos del art. 20 CFF",
         {"periodo": "2026-07", "modo": "resico_pf", "ventas": [{"total": 2500000, "iva": 0}], "gastos": [], "retenciones": {}}),
        ("E15-07", "Un centavo arriba de la frontera → 1.10 %",
         {"periodo": "2026-07", "modo": "resico_pf", "ventas": [{"total": 2500001, "iva": 0}], "gastos": [], "retenciones": {}}),
        ("E15-08", "Se rebasa el límite anual de RESICO: se avisa",
         {"periodo": "2026-11", "modo": "resico_pf", "ventas": [{"total": 9000000, "iva": 0}], "gastos": [], "retenciones": {},
          "ingresos_acumulados_previos": 345000000}),
        ("E15-09", "Mes en curso (ventas del 1 al 10 de octubre): se aparta desde ya lo que se debe por lo cobrado",
         {"periodo": "2026-10", "modo": "resico_pf", "ventas": [{"total": 16000000, "iva": 0}], "gastos": [], "retenciones": {},
          "saldo_favor_iva_previo": 0, "ingresos_acumulados_previos": 6000000}),
        ("E15-10", "Redondeo: ISR al centavo mitad hacia arriba (12,345.67 → 12,346) y ajuste del art. 20 CFF a CADA "
                   "impuesto antes de sumar (123.46 → 123; 1,975.31 → 1,975; total 2,098, no 2,099)",
         {"periodo": "2026-08", "modo": "resico_pf", "ventas": [{"total": 1432098, "iva": 197531}], "gastos": [],
          "retenciones": {}}),
    ]
    impuestos = [{"id": i, "descripcion": d, "entrada": e, "esperado": impuestos_mes(e, c)} for i, d, e in casos]
    iva = [{"total": t, "tasa_bp": 1600, "esperado": iva_incluido(t)} for t in [116000, 10000, 1, 100, 3480000, 34800]]
    cff = [{"centavos": x, "esperado": ajustar_cff(x)} for x in [123450, 123451, 123499, 123401, 100, 0, 50, 51]]
    return {"config": c, "impuestos_mes": impuestos, "iva_incluido": iva, "ajustar_cff": cff}


def vectores_e16():
    sal = "000102030405060708090a0b0c0d0e0f"
    return {"kdf": [
        {"id": "E16-01", "descripcion": "RFC 7914 §12, primer vector (sin normalización: contraseña vacía)",
         "contrasena": "", "sal_hex": "", "n": 16, "r": 1, "p": 1, "largo": 64,
         "esperado_hex": kdf_respaldo("", "", 16, 1, 1, 64)},
        {"id": "E16-02", "descripcion": "Parámetros de prueba rápidos",
         "contrasena": "correcto caballo batería grapa", "sal_hex": sal, "n": 16384, "r": 8, "p": 1, "largo": 32,
         "esperado_hex": kdf_respaldo("correcto caballo batería grapa", sal, 16384, 8, 1)},
        {"id": "E16-03", "descripcion": "La misma contraseña escrita con caracteres descompuestos (n + tilde combinante) da la misma llave",
         "contrasena": "contraseña segura 2026", "sal_hex": sal, "n": 16384, "r": 8, "p": 1, "largo": 32,
         "esperado_hex": kdf_respaldo("contraseña segura 2026", sal, 16384, 8, 1)},
        {"id": "E16-04", "descripcion": "Parámetros de producción (N = 2^17, r = 8, p = 1)",
         "contrasena": "correcto caballo batería grapa", "sal_hex": sal, "n": 131072, "r": 8, "p": 1, "largo": 32,
         "esperado_hex": kdf_respaldo("correcto caballo batería grapa", sal, 131072, 8, 1)},
    ]}


def construir_vectores() -> dict:
    return {
        "version": 3,
        "generado_por": "fixtures/motores/oraculo.py",
        "convenciones": {
            "dinero": "centavos enteros (int). 150000 = $1,500.00",
            "fechas": "fechas civiles ISO 'YYYY-MM-DD'; dia_semana ISO 1=lunes ... 7=domingo",
            "puntos_base": "bp: 10000 = 100 %",
            "flotantes": "probabilidades y similitudes se comparan con tolerancia 1e-6 salvo que el vector diga otra cosa",
        },
        "E1": vectores_e1(),
        "E3": vectores_e3(),
        "E4": vectores_e4(),
        "E5": vectores_e5(),
        "E6": vectores_e6(),
        "E7": vectores_e7(),
        "E8": vectores_e8(),
        "E9": vectores_e9(),
        "E10": vectores_e10(),
        "E11": vectores_e11(),
        "E12": vectores_e12(),
        "E13": vectores_e13(),
        "E14": vectores_e14(),
        "E15": vectores_e15(),
        "E16": vectores_e16(),
        "NLU_resolver": vectores_resolver(),
        "PRD_economia_unitaria": [
            economia(6900, 1, 800),
            economia(59900, 12, 800),
        ],
    }


def serializar(vectores: dict) -> str:
    return json.dumps(vectores, ensure_ascii=False, indent=1) + "\n"


def main(argv: list[str]) -> int:
    """Sin argumentos: imprime los vectores. --escribir: regenera vectores.json (LF, UTF-8).
    --verificar: compara con vectores.json (como JSON, no como texto) y sale con 1 si difieren."""
    import os
    import sys
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vectores.json")
    vectores = construir_vectores()
    if "--escribir" in argv:
        with open(ruta, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(serializar(vectores))
        print(f"escrito {ruta}")
        return 0
    if "--verificar" in argv:
        with open(ruta, encoding="utf-8") as fh:
            actual = json.load(fh)
        esperado = json.loads(serializar(vectores))
        if actual == esperado:
            print("OK: vectores.json coincide con el oráculo")
            return 0
        diferentes = sorted(k for k in set(actual) | set(esperado) if actual.get(k) != esperado.get(k))
        print("ERROR: vectores.json NO coincide con el oráculo en: " + ", ".join(diferentes), file=sys.stderr)
        print("No edites vectores.json a mano: cambia docs/05-MOTORES.md y el oráculo, y regenera con --escribir.",
              file=sys.stderr)
        return 1
    sys.stdout.write(serializar(vectores))
    return 0


if __name__ == "__main__":
    import sys
    raise SystemExit(main(sys.argv[1:]))
