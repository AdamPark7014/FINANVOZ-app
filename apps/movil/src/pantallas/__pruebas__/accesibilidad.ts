import { StyleSheet } from 'react-native';
import { tieneCifra } from '../../ui/formato';

/**
 * Auditoría de accesibilidad sobre el árbol nativo que renderiza jest (CA-M7-05, `02 §15`). No sustituye
 * recorrer las pantallas con TalkBack en el teléfono; fija lo que sí se puede comprobar sin él:
 *
 * - Ningún texto se trunca: sin `numberOfLines`, `ellipsizeMode` ni `adjustsFontSizeToFit`, y el texto escala
 *   con la preferencia del sistema hasta 200 % (`allowFontScaling` no apagado, `maxFontSizeMultiplier` ≥ 2).
 * - Toda cifra de dinero visible tiene una etiqueta hablada sin "$" ni dígitos ("doscientos catorce pesos"),
 *   y su caja no tiene alto ni ancho fijo que la corte al crecer.
 * - Todo lo que se toca se anuncia con su rol y su nombre, mide ≥ 48 dp (o amplía el área con `hitSlop`) y su
 *   nombre tampoco trae cifras sin leer.
 */
export interface Hallazgo {
  readonly regla: string;
  readonly donde: string;
}

/** Nodo de `screen.toJSON()` (árbol nativo del renderizador de pruebas). */
interface Nodo {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: (Nodo | string)[] | null;
}
type Props = Record<string, unknown>;

const ROLES_TOCABLES = new Set(['button', 'switch', 'radio', 'checkbox', 'link', 'tab', 'menuitem']);
const MIN_TACTIL = 48;

function textoDe(n: Nodo | string): string {
  if (typeof n === 'string') return n;
  return (n.children ?? []).map((h: Nodo | string) => textoDe(h)).join('');
}

function oculto(p: Props): boolean {
  return p.accessibilityElementsHidden === true || p.importantForAccessibility === 'no-hide-descendants';
}

function estilo(p: Props): Record<string, unknown> {
  return (StyleSheet.flatten(p.style as never) ?? {}) as Record<string, unknown>;
}

function resumen(texto: string): string {
  return texto.length > 60 ? `${texto.slice(0, 57)}…` : texto;
}

export interface OpcionesAuditoria {
  /**
   * M13 (RNF-08): además, todo lo tocable y todo campo traen `accessibilityLabel` propia (no basta el texto
   * de los hijos, que TalkBack puede leer en otro orden o junto con íconos), y todo lo tocable trae rol.
   */
  readonly etiquetaExplicita?: boolean;
}

export function auditar(raiz: Nodo | Nodo[] | null, opciones: OpcionesAuditoria = {}): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  const agregar = (regla: string, donde: string) => hallazgos.push({ regla, donde: resumen(donde) });

  const visitar = (n: Nodo | string, etiquetaAncestro: string | null) => {
    if (typeof n === 'string') return;
    const p = n.props as Props;
    if (oculto(p)) return;
    const etiquetaPropia =
      typeof p.accessibilityLabel === 'string' && p.accessibilityLabel !== '' ? p.accessibilityLabel : null;
    const agrupa = p.accessible === true && etiquetaPropia !== null;
    const etiqueta = etiquetaPropia ?? etiquetaAncestro;
    const texto = textoDe(n);

    if (n.type === 'Text') {
      // Un texto vacío no tiene nada que cortar (p. ej. el título vacío que React Navigation monta en la barra de
      // Android junto a un botón propio de atrás).
      if (p.numberOfLines !== undefined && p.numberOfLines !== 0 && texto.trim() !== '')
        agregar('texto truncado (numberOfLines)', texto);
      if (p.ellipsizeMode !== undefined) agregar('texto truncado (ellipsizeMode)', texto);
      if (p.adjustsFontSizeToFit) agregar('texto que se encoge (adjustsFontSizeToFit)', texto);
      if (p.allowFontScaling === false) agregar('texto que no escala', texto);
      if (
        typeof p.maxFontSizeMultiplier === 'number' &&
        p.maxFontSizeMultiplier > 0 &&
        p.maxFontSizeMultiplier < 2
      ) {
        agregar('texto que no llega a 200 %', texto);
      }
      if (tieneCifra(texto)) {
        if (!etiqueta) agregar('cifra sin etiqueta hablada', texto);
        else if (tieneCifra(etiqueta) || !/peso|centavo/.test(etiqueta)) {
          agregar('cifra con etiqueta que no la dice en palabras', `${texto} → ${etiqueta}`);
        }
        const e = estilo(p);
        for (const k of ['height', 'maxHeight', 'width', 'maxWidth']) {
          if (e[k] !== undefined) agregar(`cifra con ${k} fijo`, texto);
        }
      }
      // Los Text anidados heredan; no se revisan por separado.
      return;
    }

    if (n.type === 'TextInput') {
      if (!etiquetaPropia) agregar('campo sin etiqueta', String(p.placeholder ?? p.testID ?? ''));
    }

    const rol = typeof p.accessibilityRole === 'string' ? p.accessibilityRole : null;
    // `accessible={false}` (Tarjeta con `accionesAnidadas`): el área de toque extra no existe para el lector de
    // pantalla, que llega al botón equivalente de adentro; ese botón es el que se audita.
    const fueraDelLector = p.accessible === false;
    const tocable =
      !fueraDelLector &&
      ((typeof p.onClick === 'function' && rol !== 'text') || (rol !== null && ROLES_TOCABLES.has(rol)));
    if (tocable && n.type !== 'TextInput') {
      const nombre = etiquetaPropia ?? texto;
      if (!rol || !ROLES_TOCABLES.has(rol)) agregar('tocable sin rol', nombre || String(p.testID ?? ''));
      if (!nombre.trim()) agregar('tocable sin nombre', String(p.testID ?? ''));
      if (opciones.etiquetaExplicita && !etiquetaPropia)
        agregar('tocable sin accessibilityLabel', nombre || String(p.testID ?? ''));
      if (tieneCifra(nombre)) agregar('tocable con cifra sin leer', nombre);
      const e = estilo(p);
      const alto = Math.max(Number(e.minHeight ?? 0), Number(e.height ?? 0));
      if (alto < MIN_TACTIL && p.hitSlop === undefined) agregar('tocable menor a 48 dp', nombre);
    }

    const siguiente = agrupa ? etiquetaPropia : etiqueta;
    for (const h of n.children ?? []) visitar(h, siguiente);
  };

  for (const n of Array.isArray(raiz) ? raiz : raiz ? [raiz] : []) visitar(n, null);
  return hallazgos;
}

/**
 * Lo que TalkBack recorre, en orden: la etiqueta de cada elemento accesible (o el texto si no tiene) en el
 * orden del árbol, que es el orden de lectura en Android.
 */
export function ordenDeLectura(raiz: Nodo | Nodo[] | null): string[] {
  const lista: string[] = [];
  const visitar = (n: Nodo | string) => {
    if (typeof n === 'string') return;
    const p = n.props as Props;
    if (oculto(p)) return;
    const etiqueta = typeof p.accessibilityLabel === 'string' ? p.accessibilityLabel : null;
    if (n.type === 'Text' || (p.accessible === true && etiqueta)) {
      lista.push(etiqueta ?? textoDe(n));
      return;
    }
    for (const h of n.children ?? []) visitar(h);
  };
  for (const n of Array.isArray(raiz) ? raiz : raiz ? [raiz] : []) visitar(n);
  return lista;
}
