import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Centavos } from '@cartera/core';
import { chipsIntencion, unirPrefijo, type ChipIntencion } from '../../asistente/chips';
import { useConfirmacionPorVoz } from '../../asistente/confirmacion-voz';
import { leerPuedoGastar, turnoPuedoGastar, turnosPuedoGastar } from '../../asistente/puedo-gastar';
import {
  derivarTurnosDelDia,
  idTurnoRegistro,
  preguntaAbierta,
  respuestaDeTexto,
  useConversacion,
  type TurnoConversacion,
} from '../../asistente/conversacion';
import type { FlujoConversacional } from '../../asistente/flujos';
import {
  corregirEntendi,
  movimientoDeEntendi,
  textoDeAviso,
  turnoDeExplicacion,
  turnoRegistro,
  turnosDeFlujo,
  turnosDesdeResultado,
  type AccionesRegistro,
  type PrellenadoR2,
} from '../../asistente/registro';
import type { IdFlujo, Turno } from '../../asistente/tipos';
import {
  bucketLatencia,
  contarEsperandoConexion,
  deshacer as deshacerServicio,
  descartarPorInterpretar,
  explicar,
  funcionesPlan,
  listarCuentas,
  listarMovimientos,
  listarPorInterpretar,
  marcarObservacionVista,
  meAlcanza,
  mensajeError,
  obtenerHoy,
  obtenerObservaciones,
  obtenerPlan,
  registrarTexto,
  registrarTextoLocal,
  revisarPorInterpretar,
  type ConsultaMeAlcanza,
  type FiltroMovimientos,
  type Observacion,
  type OpcionesBloques,
  type OrigenDictado,
  type ResultadoTexto,
  type VistaHoy,
} from '../../servicios';
import { contextoInterprete } from '../../servicios/registrar';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { usePlanTienda } from '../../suscripciones/ProveedorPlan';
import { useMicrofono, useVozAsistente, type FinHabla, type Microfono, type MotorDictado } from '../../voz';
import { lineaCambioDia } from '../principal/textos';
import { cifraHoyMostrada, useRecordarHoyVisto } from '../principal/useAvisoRegistro';
import {
  suscribirGuardadosR2,
  suscribirPedidosAsistente,
  tomarGuardadosR2,
  tomarPedidoAsistente,
} from './r2';
import { useProbabilidadDelDia } from './useProbabilidadDelDia';

/** Navegación que el asistente necesita de la ruta (`app/(tabs)/hoy.tsx`). */
export interface NavegacionAsistente {
  /** Movimientos; con filtro desde «Ver movimientos» de una consulta (`06 §6`). */
  alVerMovimientos: (filtro?: FiltroMovimientos) => void;
  /** Detalle de un movimiento registrado. */
  alVerMovimiento?: (transaccionId: string) => void;
  alConfigurarIngreso: () => void;
  /** R2 vacío («Registrar con formulario»). */
  alAbrirFormulario: () => void;
  /** R2 con lo dicho («Cambiar», reparación); sin esto abre R2 vacío. */
  alAbrirR2?: (p: PrellenadoR2) => void;
  /** Arqueo de efectivo (`02 §7`): insignia, «Contar efectivo» sin flujo o «traigo 300». */
  alAbrirArqueo?: (efectivoReal?: Centavos) => void;
  /** «¿Me alcanza?» (`02 §9`): con el botón del desglose (sin consulta) o diciendo «¿me alcanza para…?». */
  alAbrirMeAlcanza?: (consulta?: ConsultaMeAlcanza) => void;
  alAbrirAjustes?: () => void;
  /** Formulario largo de un flujo conversacional («Cambiar algo»). */
  alAbrirRuta?: (ruta: string | { pathname: string; params: Record<string, string> }) => void;
}

export interface OpcionesAsistente {
  navegacion: NavegacionAsistente;
  /** Reconocedor inyectable (pruebas). */
  motor?: MotorDictado;
  /** Abre con el campo de texto a la vista (y el foco). */
  abiertoAlInicio?: boolean;
  /** Micrófono del widget: empieza a escuchar al abrir. */
  dictarAlAbrir?: boolean;
  /** Id de una frase de «Por revisar» que se vuelve a interpretar al abrir. */
  fraseRevision?: string;
  /** Tras un «Entendí» que vino por voz, escucha un turno para «sí» / «no» (encendido por omisión). */
  confirmarPorVoz?: boolean;
  /** Opciones del cálculo por bloques de la probabilidad (pruebas). */
  bloques?: Omit<OpcionesBloques, 'senal'>;
  /** Solo los turnos de esta sesión (el panel dentro de otra pantalla no repite el día). */
  soloSesion?: boolean;
  /** Flujos conversacionales inyectables (pruebas); por omisión `FLUJOS`. */
  flujos?: Partial<Record<IdFlujo, FlujoConversacional<unknown>>>;
}

export interface Asistente {
  readonly vista: VistaHoy;
  /** «Lo que veo» ya calculado (se muestran dos). */
  readonly observaciones: readonly Observacion[];
  readonly turnos: readonly TurnoConversacion[];
  readonly idsSesion: ReadonlySet<string>;
  readonly microfono: Microfono;
  readonly escribiendo: boolean;
  readonly setEscribiendo: (v: boolean | ((x: boolean) => boolean)) => void;
  readonly texto: string;
  readonly setTexto: (t: string) => void;
  readonly interpretando: boolean;
  /** Escuchando el «sí» / «no» de una tarjeta «Entendí» que vino por voz. */
  readonly escuchandoConfirmacion: boolean;
  readonly parcialConfirmacion: string;
  readonly esperandoConexion: number;
  readonly chips: readonly ChipIntencion[];
  readonly enviar: (frase: string, origen: OrigenDictado) => void;
  readonly tocarChip: (chip: ChipIntencion) => void;
  readonly abrirFormulario: () => void;
  /** Turnos de tarjeta: lo que guardó la tarjeta vuelve como resultado o como mensaje. */
  readonly alResultadoTarjeta: (id: string, r: ResultadoTexto) => void;
  readonly alListoTarjeta: (id: string, mensaje: string) => void;
  readonly resolver: (id: string) => void;
  readonly verDesglose: boolean;
  readonly setVerDesglose: (v: boolean | ((x: boolean) => boolean)) => void;
  readonly plus: ReturnType<typeof funcionesPlan>;
  readonly conTienda: boolean;
  /** El asistente está hablando (para el indicador). */
  readonly hablando: boolean;
  /** Para la raíz de la pantalla: cualquier toque calla la voz. */
  readonly cortarAlTocar: ReturnType<typeof useVozAsistente>['cortarAlTocar'];
}

/**
 * Toda la conversación del asistente sin UI (Ola 7 §4): turnos derivados del día + sesión, envío de frases (nivel 0
 * al instante; nube si hay), resultados → turnos, preguntas abiertas que se contestan hablando, confirmación por voz,
 * chips de intención, R2 y flujos. La pantalla (`PantallaAsistente`) solo pinta.
 */
export function useAsistente(o: OpcionesAsistente): Asistente {
  const { navegacion: nav, confirmarPorVoz = true } = o;
  const { ctx, refrescar, nube } = useSesion();
  const registrarEvento = useAnalitica();
  const { abrirPlan } = usePlanTienda();
  const vista = useVista(obtenerHoy);
  const plus = useVista(funcionesPlan);
  const plan = useVista(obtenerPlan).plan;
  // La voz del asistente (V-2): «Contestarte en voz», la voz y la velocidad guardadas en Ajustes › Voz.
  const voz = useVozAsistente();
  const observaciones = useVista(obtenerObservaciones);
  // «N frases esperan internet» solo si hay intérprete en internet: sin nube nunca se promete (criterio 12).
  const enCola = useVista(contarEsperandoConexion);
  const esperandoConexion = nube ? enCola : 0;
  const movimientosHoy = useVista((c) => {
    const hoy = c.reloj.hoy();
    return listarMovimientos(c, { desde: hoy, hasta: hoy }).flatMap((d) => d.movimientos);
  });
  const cuentas = useVista(listarCuentas);
  const probabilidad = useProbabilidadDelDia(plus.probabilidad && vista.estado !== 'sin_ingreso', o.bloques);

  const [verDesglose, setVerDesglose] = useState(false);
  const [escribiendo, setEscribiendo] = useState(o.abiertoAlInicio ?? false);
  const [texto, setTexto] = useState('');
  const [interpretando, setInterpretando] = useState(o.fraseRevision !== undefined);
  /** Tarjeta «Entendí» que vino por voz y espera «sí» / «no» hablado; `clave` vuelve a escuchar tras un cambio. */
  const [confirmacion, setConfirmacion] = useState<{ id: string; clave: number } | null>(null);
  const confirmacionRef = useRef(confirmacion);

  // La cifra que se ve ahora: el «antes» de «Tu día pasa de $220 a $214».
  const cifraVista = cifraHoyMostrada(vista);
  useRecordarHoyVisto(cifraVista);
  const cifraRef = useRef(cifraVista);

  // La navegación va por referencia (cambia en cada render de la ruta) y se lee solo al tocar algo.
  const navRef = useRef(nav);
  useEffect(() => {
    navRef.current = nav;
    cifraRef.current = cifraVista;
    confirmacionRef.current = confirmacion;
  });
  const conArqueo = nav.alAbrirArqueo !== undefined;
  const irMovimientos = useCallback((f?: FiltroMovimientos) => navRef.current.alVerMovimientos(f), []);
  const irMovimiento = useCallback((id: string) => navRef.current.alVerMovimiento?.(id), []);
  const irArqueo = useCallback(() => navRef.current.alAbrirArqueo?.(), []);

  const soloSesion = o.soloSesion === true;
  const derivados = useMemo(
    () =>
      soloSesion
        ? []
        : derivarTurnosDelDia(
            // Las acciones solo se guardan en los turnos y se llaman al tocar (no durante el render).
            // eslint-disable-next-line react-hooks/refs
            {
              movimientosHoy,
              observaciones,
              probabilidad: plus.probabilidad ? probabilidad : null,
              tarjetaDelDia: plus.tarjetaDelDia ? (vista.tarjetaDelDia?.texto ?? null) : null,
              acciones: {
                verMovimientos: irMovimientos,
                verMovimiento: irMovimiento,
                ocultarObservacion: (clave) => {
                  marcarObservacionVista(ctx, clave);
                  refrescar();
                },
                ...(conArqueo ? { abrirArqueo: irArqueo } : {}),
                verDesglose: () => setVerDesglose(true),
              },
            },
            vista,
          ),
    [
      vista,
      movimientosHoy,
      observaciones,
      probabilidad,
      plus,
      ctx,
      refrescar,
      conArqueo,
      soloSesion,
      irMovimientos,
      irMovimiento,
      irArqueo,
    ],
  );
  const { turnos, sesion, agregar, reemplazar, resolver, nuevoId } = useConversacion(derivados);
  const turnosRef = useRef(turnos);
  useEffect(() => {
    turnosRef.current = turnos;
  }, [turnos]);

  /** Solo para la analítica (`03 §8`): cuándo empezó, qué nivel respondió y si hubo que preguntar. */
  const medicion = useRef<{ inicio: number; nivel: 'reglas' | 'nube'; pregunto: boolean } | null>(null);
  const enRevision = useRef<string | null>(o.fraseRevision ?? null);
  const prefijo = useRef<string | null>(null);
  /** Deja de esperar el «sí» hablado (cualquier toque, o la tarjeta ya se contestó). */
  const cancelarConfirmacion = useRef<() => void>(() => {});

  const contarRegistro = useCallback(
    (origen: OrigenDictado) => {
      const m = medicion.current;
      medicion.current = null;
      registrarEvento({
        nombre: 'movimiento_registrado',
        propiedades: {
          origen,
          pregunto: m?.pregunto ?? false,
          espacio: 'personal',
          ...(m ? { nivel_interprete: m.nivel } : {}),
          ...(m && !m.pregunto ? { latencia_bucket: bucketLatencia(Date.now() - m.inicio) } : {}),
        },
      });
    },
    [registrarEvento],
  );

  /** La frase en revisión ya no hace falta: se quita de «Por revisar». */
  const terminarRevision = useCallback(() => {
    const id = enRevision.current;
    enRevision.current = null;
    if (!id) return;
    try {
      descartarPorInterpretar(ctx, id);
    } catch {
      // Ya no existe.
    }
  }, [ctx]);

  const cambioDia = useCallback((): string | null => {
    const antes = cifraRef.current;
    if (antes === null) return null;
    try {
      const despues = cifraHoyMostrada(obtenerHoy(ctx));
      return despues === null || despues === antes ? null : lineaCambioDia(antes, despues);
    } catch {
      return null;
    }
  }, [ctx]);

  const abrirR2 = useCallback((p: PrellenadoR2) => {
    const n = navRef.current;
    if (n.alAbrirR2) n.alAbrirR2(p);
    else n.alAbrirFormulario();
  }, []);

  /**
   * La respuesta hablada, en un solo lugar (`voz.decirTurno`, la frase corta de `fraseHablada`): qué se registró o
   * qué pasa con tu día y, tras un registro, cuánto puedes gastar hoy. Resuelve al terminar de hablar.
   */
  const decirTurno = voz.decirTurno;
  const contestarEnVoz = useCallback(
    (turno: TurnoConversacion): Promise<FinHabla> => {
      if (turno.de !== 'asistente' || turno.clase === 'tarjeta') return Promise.resolve('omitida');
      let hoyPuedes: number | null = null;
      if (turno.clase === 'registro') {
        try {
          hoyPuedes = obtenerHoy(ctx).hoyPuedesCentavos;
        } catch {
          hoyPuedes = null;
        }
      }
      return decirTurno(turno, { hoyPuedes });
    },
    [ctx, decirTurno],
  );

  // `enviar` y `mostrar` se llaman entre sí (aclarar, reparación, «Sí, regístralo»): van por referencia.
  const enviarRef = useRef<(frase: string, origen: OrigenDictado, nueva?: boolean) => void>(() => {});
  const mostrarRef = useRef<
    (r: ResultadoTexto, origen: OrigenDictado, oido: string, reemplaza?: string) => void
  >(() => {});

  const conPlusMeAlcanza = plus.meAlcanza;
  const acciones = useCallback(
    (origen: OrigenDictado, oido: string): AccionesRegistro => {
      const a: AccionesRegistro = {
        porVoz: origen === 'voz',
        oido,
        plan,
        nuevoId,
        cambioDia,
        deshacer: (token) => {
          deshacerServicio(ctx, token);
          refrescar();
        },
        agregar,
        reemplazar,
        refrescar,
        mostrar: (r, reemplaza) => mostrarRef.current(r, origen, oido, reemplaza),
        enviar: (frase) => enviarRef.current(frase, origen, true),
        corregirOido: (frase) => {
          setTexto(frase);
          setEscribiendo(true);
        },
        abrirR2,
        verMovimientos: (filtro) => navRef.current.alVerMovimientos(filtro),
        verMovimiento: (id) => navRef.current.alVerMovimiento?.(id),
        ...(navRef.current.alAbrirMeAlcanza
          ? { abrirMeAlcanza: (c: ConsultaMeAlcanza) => navRef.current.alAbrirMeAlcanza?.(c) }
          : {}),
        abrirArqueo: (efectivo) => navRef.current.alAbrirArqueo?.(efectivo),
        abrirIngreso: () => navRef.current.alConfigurarIngreso(),
        abrirRuta: (ruta) => navRef.current.alAbrirRuta?.(ruta),
        explicar: (pregunta, id) => {
          explicar(ctx, pregunta, { nube, registrarEvento })
            .then((e) =>
              reemplazar(
                turnoDeExplicacion(id, e, { verMovimientos: (f) => navRef.current.alVerMovimientos(f) }),
              ),
            )
            .catch((e: unknown) =>
              reemplazar({ id, de: 'asistente', clase: 'texto', texto: mensajeError(e) }),
            );
        },
        ...(o.flujos ? { flujos: o.flujos } : {}),
        // «¿Puedo gastar?» con Plus (o su prueba): las opciones se calculan aparte y el turno se rehace al tenerlas.
        ...(conPlusMeAlcanza
          ? {
              calcularPuedoGastar: (consulta: ConsultaMeAlcanza, id: string) => {
                meAlcanza(ctx, consulta, o.bloques ?? {})
                  .then((v) => reemplazar(turnoPuedoGastar(ctx, consulta, a, id, v)))
                  .catch(() => reemplazar(turnoPuedoGastar(ctx, consulta, a, id)));
              },
            }
          : {}),
      };
      return a;
    },
    [
      abrirR2,
      agregar,
      cambioDia,
      conPlusMeAlcanza,
      ctx,
      nube,
      nuevoId,
      plan,
      refrescar,
      reemplazar,
      registrarEvento,
      o.flujos,
      o.bloques,
    ],
  );

  const mostrar = useCallback(
    (r: ResultadoTexto, origen: OrigenDictado, oido: string, reemplaza?: string) => {
      const nuevos = turnosDesdeResultado(ctx, r, acciones(origen, oido));
      if (reemplaza) {
        resolver(reemplaza);
        // La tarjeta ya se contestó: ya no se espera el «sí» hablado.
        if (confirmacionRef.current?.id === reemplaza) cancelarConfirmacion.current();
      }
      agregar(...nuevos);
      switch (r.resultado) {
        case 'registrado':
        case 'registrado_msi':
        case 'registrado_division':
        case 'registrado_tanda':
          contarRegistro(origen);
          terminarRevision();
          break;
        case 'corregido':
        case 'anulado':
        case 'pasar_a_meses':
        case 'configurado':
        case 'colchon_configurado':
        case 'tarjeta_configurada':
        case 'consulta':
        case 'explicar':
        case 'arqueo':
        case 'me_alcanza':
          terminarRevision();
          break;
        default:
          if (medicion.current) medicion.current.pregunto = true;
      }
      refrescar();
      const primero = nuevos[0];
      if (origen !== 'voz' || !primero || primero.de !== 'asistente') return;
      if (primero.clase === 'entendi' && confirmarPorVoz) {
        // Primero se dice la tarjeta y solo al terminar se abre el micrófono (abrirlo corta la voz); si un toque la
        // cortó, ya no se escucha el «sí».
        const id = primero.id;
        void contestarEnVoz(primero).then((fin) => {
          if (fin !== 'cortada') setConfirmacion({ id, clave: 0 });
        });
      } else void contestarEnVoz(primero);
    },
    [
      acciones,
      agregar,
      confirmarPorVoz,
      contarRegistro,
      contestarEnVoz,
      ctx,
      refrescar,
      resolver,
      terminarRevision,
    ],
  );
  useEffect(() => {
    mostrarRef.current = mostrar;
  }, [mostrar]);

  const enviar = useCallback(
    (frase: string, origen: OrigenDictado, nueva = false) => {
      const limpio = frase.trim();
      if (limpio === '' || interpretando) return;
      const porVoz = origen === 'voz';
      // Una pregunta abierta se contesta hablando o escribiendo (un chip o su campo); lo demás es frase nueva.
      const abierta = nueva ? null : preguntaAbierta(turnosRef.current);
      if (abierta) {
        const r = respuestaDeTexto(abierta, limpio, porVoz);
        if (r.tipo === 'chip' || abierta.campo) {
          setTexto('');
          abierta.responder(r);
          return;
        }
      }
      setTexto('');
      agregar({ id: nuevoId('persona'), de: 'persona', texto: limpio, porVoz });
      medicion.current = { inicio: Date.now(), nivel: 'reglas', pregunto: false };
      let local: ResultadoTexto | null;
      try {
        local = registrarTextoLocal(ctx, limpio, origen);
      } catch (e) {
        agregar({ id: nuevoId('texto'), de: 'asistente', clase: 'texto', texto: mensajeError(e) });
        return;
      }
      // «¿Puedo gastar 500 en unos tenis?» se contesta en el teléfono (cero tokens) si el nivel 0 no la tomó.
      const puedo = local === null || local.resultado === 'no_entendi' ? leerPuedoGastar(limpio) : null;
      if (puedo) {
        const turnos = turnosPuedoGastar(ctx, puedo, acciones(origen, limpio));
        agregar(...turnos);
        const primero = turnos[0];
        if (porVoz && primero) void contestarEnVoz(primero);
        return;
      }
      if (local) {
        mostrar(local, origen, limpio);
        return;
      }
      medicion.current.nivel = 'nube';
      setInterpretando(true);
      registrarTexto(ctx, limpio, origen, { nube })
        .then((r) => mostrar(r, origen, limpio))
        .catch((e: unknown) =>
          agregar({ id: nuevoId('texto'), de: 'asistente', clase: 'texto', texto: mensajeError(e) }),
        )
        .finally(() => setInterpretando(false));
    },
    [acciones, agregar, contestarEnVoz, ctx, interpretando, mostrar, nube, nuevoId],
  );
  useEffect(() => {
    enviarRef.current = enviar;
  }, [enviar]);

  // El micrófono de la pantalla: frase nueva o respuesta a una pregunta abierta (con chip de prefijo si se tocó).
  const microfonoBase = useMicrofono({
    ...(o.motor ? { motor: o.motor } : {}),
    alTerminar: (t) => {
      const p = prefijo.current;
      prefijo.current = null;
      enviarRef.current(p ? unirPrefijo(p, t) : t, 'voz');
    },
  });
  const { iniciar: iniciarMicrofono } = microfonoBase;

  // Tras un «Entendí» que vino por voz: escucha un turno de hasta 6 s (`useConfirmacionPorVoz`, A-2). «Sí» confirma,
  // «no» abre «Cambiar», «no, fue con la Nu» / «eran 40» cambia la fila y vuelve a escuchar; si no oye nada, la
  // tarjeta espera el toque. Cualquier toque lo cancela.
  const turnoConfirmar = confirmacion
    ? turnos.find(
        (t): t is Extract<Turno, { clase: 'entendi' }> =>
          t.id === confirmacion.id && t.de === 'asistente' && t.clase === 'entendi',
      )
    : undefined;
  const propuestaConfirmar = turnoConfirmar?.propuesta;
  const movimiento = propuestaConfirmar ? movimientoDeEntendi(propuestaConfirmar) : null;
  const contextoConfirmacion = useMemo(
    () =>
      propuestaConfirmar
        ? {
            ...contextoInterprete(ctx),
            // La cifra grande también se corrige hablando («eran 40»): cuenta como fila `monto`.
            filas: [
              ...(propuestaConfirmar.monto !== undefined ? ['monto'] : []),
              ...propuestaConfirmar.filas.map((f) => f.clave),
            ],
            ...(movimiento ? { movimiento } : {}),
          }
        : {},
    [ctx, propuestaConfirmar, movimiento],
  );
  const porVoz = useConfirmacionPorVoz({
    activo: propuestaConfirmar !== undefined,
    clave: `${confirmacion?.id ?? ''}:${confirmacion?.clave ?? 0}`,
    contexto: contextoConfirmacion,
    ...(o.motor ? { motor: o.motor } : {}),
    alSi: () => {
      setConfirmacion(null);
      // Con «Sí» inactivo (falta elegir la cuenta) un «sí» dicho no guarda: la tarjeta espera el toque.
      if (!propuestaConfirmar || propuestaConfirmar.confirmar.deshabilitado) return;
      Promise.resolve()
        .then(() => propuestaConfirmar.confirmar.accion())
        .catch((e: unknown) =>
          agregar({ id: nuevoId('texto'), de: 'asistente', clase: 'texto', texto: mensajeError(e) }),
        );
    },
    alNo: () => {
      setConfirmacion(null);
      void propuestaConfirmar?.cambiar?.accion();
    },
    alCambio: ({ cambios }) => {
      const nuevo = propuestaConfirmar ? corregirEntendi(propuestaConfirmar, cambios) : null;
      if (!nuevo) {
        setConfirmacion(null);
        return;
      }
      reemplazar(nuevo);
      // La tarjeta cambió: se escucha otro turno para el «sí».
      setConfirmacion((c) => (c ? { id: c.id, clave: c.clave + 1 } : c));
    },
    alOtro: () => setConfirmacion(null),
  });
  const cancelarPorVoz = porVoz.cancelar;
  useEffect(() => {
    cancelarConfirmacion.current = () => {
      cancelarPorVoz();
      setConfirmacion(null);
    };
  }, [cancelarPorVoz]);

  // Cualquier toque en el micrófono deja de esperar el «sí» hablado.
  const microfono: Microfono = useMemo(
    () => ({
      ...microfonoBase,
      boton: {
        ...microfonoBase.boton,
        alPresionarDentro: () => {
          if (confirmacionRef.current) cancelarConfirmacion.current();
          microfonoBase.boton.alPresionarDentro();
        },
      },
    }),
    [microfonoBase],
  );

  /** «Revisar» desde «Por revisar»: se interpreta de nuevo con la fecha en que se dijo. */
  const vigenteRevision = useRef(true);
  useEffect(
    () => () => {
      vigenteRevision.current = false;
    },
    [],
  );
  const revisarFrase = useCallback(
    (id: string) => {
      enRevision.current = id;
      setInterpretando(true);
      const frase = listarPorInterpretar(ctx).find((f) => f.id === id);
      revisarPorInterpretar(ctx, id, nube)
        .then((r) => {
          if (!vigenteRevision.current) return;
          if (frase) agregar({ id: nuevoId('persona'), de: 'persona', texto: frase.texto, porVoz: false });
          if (r) mostrar(r, frase?.origen ?? 'texto', frase?.texto ?? '');
          refrescar();
        })
        .catch((e: unknown) => {
          if (vigenteRevision.current)
            agregar({ id: nuevoId('texto'), de: 'asistente', clase: 'texto', texto: mensajeError(e) });
        })
        .finally(() => {
          if (vigenteRevision.current) setInterpretando(false);
        });
    },
    [agregar, ctx, mostrar, nube, nuevoId, refrescar],
  );

  useEffect(() => {
    if (o.dictarAlAbrir) void iniciarMicrofono();
    const frase = o.fraseRevision;
    // Fuera del cuerpo del efecto: revisar actualiza estado.
    if (frase) void Promise.resolve().then(() => revisarFrase(frase));
    // Solo al montar: el widget y «Revisar» abren la pantalla una vez por toque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enlaces de antes (`/registrar?dictar=1`, `/registrar?frase=<id>`): la ruta los deja y aquí se atienden.
  useEffect(() => {
    const atender = () => {
      const p = tomarPedidoAsistente();
      if (!p) return;
      if (p.tipo === 'dictar') void iniciarMicrofono();
      else revisarFrase(p.frase);
    };
    atender();
    return suscribirPedidosAsistente(atender);
  }, [iniciarMicrofono, revisarFrase]);

  // Lo que se guardó en `/registrar` (R2 o un formulario largo) vuelve como turno «Registré…» con Deshacer.
  useEffect(() => {
    const recoger = () => {
      const guardados = tomarGuardadosR2();
      if (guardados.length === 0) return;
      const a = acciones('texto', '');
      for (const g of guardados) {
        if (g.tipo === 'resultado') {
          mostrarRef.current(g.resultado, 'texto', '');
          continue;
        }
        if (g.tipo === 'mensaje') {
          agregar(turnoRegistro(a, { id: nuevoId('listo'), texto: g.mensaje }));
          continue;
        }
        const m = g.movimiento;
        agregar(
          turnoRegistro(a, {
            id: idTurnoRegistro([m.transaccionId]),
            texto: textoDeAviso(m.mensaje),
            deshacer: m.deshacer,
            transaccionId: m.transaccionId,
          }),
        );
      }
      refrescar();
    };
    recoger();
    return suscribirGuardadosR2(recoger);
  }, [acciones, agregar, nuevoId, refrescar]);

  const hayEfectivo = cuentas.tienes.some((c) => c.subtipo === 'efectivo');
  const hayTarjetas = cuentas.debes.some((d) => d.tipo === 'tarjeta');
  const chips = chipsIntencion({ hayEfectivo, hayTarjetas });

  const tocarChip = useCallback(
    (chip: ChipIntencion) => {
      if (confirmacionRef.current) cancelarConfirmacion.current();
      if (chip.accion.tipo === 'prefijo') {
        if (escribiendo) {
          setTexto(chip.accion.texto);
          return;
        }
        prefijo.current = chip.accion.texto;
        void iniciarMicrofono();
        return;
      }
      const flujo = turnosDeFlujo(ctx, chip.accion.flujo, null, acciones('texto', ''));
      if (flujo) {
        agregar(...flujo);
        return;
      }
      if (chip.accion.flujo === 'arqueo') navRef.current.alAbrirArqueo?.();
      else abrirR2({ tipo: 'pago_tarjeta' });
    },
    [abrirR2, acciones, agregar, ctx, escribiendo, iniciarMicrofono],
  );

  const alResultadoTarjeta = useCallback(
    (id: string, r: ResultadoTexto) => mostrar(r, 'texto', '', id),
    [mostrar],
  );
  const alListoTarjeta = useCallback(
    (id: string, mensaje: string) => {
      resolver(id);
      agregar(turnoRegistro(acciones('texto', ''), { id: nuevoId('listo'), texto: mensaje }));
      terminarRevision();
      refrescar();
    },
    [acciones, agregar, nuevoId, refrescar, resolver, terminarRevision],
  );

  const idsSesion = useMemo(() => new Set(sesion.map((t) => t.id)), [sesion]);

  return {
    vista,
    observaciones,
    turnos,
    idsSesion,
    microfono,
    escribiendo,
    setEscribiendo: (v) => {
      if (confirmacionRef.current) cancelarConfirmacion.current();
      setEscribiendo(v);
    },
    texto,
    setTexto,
    interpretando,
    escuchandoConfirmacion: porVoz.escuchando,
    parcialConfirmacion: porVoz.parcial,
    esperandoConexion,
    chips,
    enviar: (frase, origen) => {
      if (confirmacionRef.current) cancelarConfirmacion.current();
      enviar(frase, origen);
    },
    tocarChip,
    abrirFormulario: () => navRef.current.alAbrirFormulario(),
    alResultadoTarjeta,
    alListoTarjeta,
    resolver,
    verDesglose,
    setVerDesglose,
    plus,
    conTienda: abrirPlan !== null,
    hablando: voz.hablando,
    cortarAlTocar: voz.cortarAlTocar,
  };
}
