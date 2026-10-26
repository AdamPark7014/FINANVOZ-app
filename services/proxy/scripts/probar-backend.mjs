#!/usr/bin/env node
// Prueba de humo del backend propio (finanvoz-api.zynoratek.com) con las mismas llamadas HTTP que hace la app
// (apps/movil/src/nube/*: fetch directo, sin SDK). No imprime llaves, tokens ni ids: solo estado HTTP y códigos.
//
//   node services/proxy/scripts/probar-backend.mjs            # todo
//   node services/proxy/scripts/probar-backend.mjs --sin-ia   # sin llamar a Claude (no gasta cupo ni tokens)
//
// Llaves: variables ANON_KEY y SERVICE_ROLE_KEY, o los archivos de C:\dev\secrets\finanvoz-backend\ (FINANVOZ_SECRETOS).
// URL: SUPABASE_URL (por omisión https://finanvoz-api.zynoratek.com).
// Crea dos usuarios anónimos y uno de correo de prueba (@example.com) y los borra al final, con sus datos en cascada.
import { randomBytes, randomUUID, X509Certificate } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import tls from 'node:tls';

// Con NODE_USE_SYSTEM_CA=1 en Windows, Node toma como raíces también los intermedios que Windows guardó en su
// almacén (p. ej. el YR1 de Let's Encrypt) y la cadena falla con UNABLE_TO_GET_ISSUER_CERT. Solo raíces
// autofirmadas: la cadena se arma con los intermedios que manda el servidor, como en el teléfono.
if (typeof tls.setDefaultCACertificates === 'function' && typeof tls.getCACertificates === 'function') {
  tls.setDefaultCACertificates(
    tls.getCACertificates('default').filter((pem) => {
      const c = new X509Certificate(pem);
      return c.subject === c.issuer;
    }),
  );
}

const URL_BASE = (process.env.SUPABASE_URL ?? 'https://finanvoz-api.zynoratek.com').replace(/\/+$/, '');
const SECRETOS = process.env.FINANVOZ_SECRETOS ?? 'C:/dev/secrets/finanvoz-backend';
const SIN_IA = process.argv.includes('--sin-ia');

function secreto(nombre) {
  if (process.env[nombre]) return process.env[nombre].trim();
  const ruta = join(SECRETOS, nombre);
  if (!existsSync(ruta)) throw new Error(`falta ${nombre} (variable o ${ruta})`);
  return readFileSync(ruta, 'utf8').trim();
}
const ANON = secreto('ANON_KEY');
const SERVICIO = secreto('SERVICE_ROLE_KEY');

const resultados = [];
function anotar(nombre, ok, detalle) {
  resultados.push({ nombre, ok });
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre} — ${detalle}`);
}

async function http(metodo, ruta, { token, llave = ANON, cuerpo, encabezados = {}, crudo } = {}) {
  const url = ruta.startsWith('http') ? ruta : `${URL_BASE}${ruta}`;
  // llave '' = sin apikey (URLs firmadas y ruta pública de Storage: la app no la manda).
  const headers = { ...(llave ? { apikey: llave } : {}), ...encabezados };
  if (token !== null) headers.Authorization = `Bearer ${token ?? llave}`;
  if (cuerpo !== undefined && crudo === undefined) headers['Content-Type'] = 'application/json';
  const inicio = Date.now();
  const r = await fetch(url, {
    method: metodo,
    headers,
    body: crudo ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
  });
  const texto = Buffer.from(await r.arrayBuffer());
  let json = null;
  try {
    json = JSON.parse(texto.toString('utf8'));
  } catch {
    /* no es JSON */
  }
  return { estado: r.status, json, bytes: texto, ms: Date.now() - inicio, headers: r.headers };
}

const payload = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
const codigo = (r) => r.json?.error ?? r.json?.code ?? r.json?.error_code ?? r.json?.message ?? '';

async function anonimo() {
  const r = await http('POST', '/auth/v1/signup', { cuerpo: { data: {} } });
  if (r.estado !== 200 || !r.json?.access_token) throw new Error(`signup anónimo ${r.estado} ${codigo(r)}`);
  return { token: r.json.access_token, id: r.json.user.id };
}

const creados = [];
async function limpiar() {
  for (const id of creados) {
    await http('DELETE', `/auth/v1/admin/users/${id}`, { llave: SERVICIO }).catch(() => {});
  }
}

async function main() {
  console.log(`Backend: ${URL_BASE}\n`);

  // ── Auth ──
  const salud = await http('GET', '/auth/v1/health');
  anotar('GET /auth/v1/health', salud.estado === 200, `${salud.estado} ${salud.json?.name ?? ''} ${salud.json?.version ?? ''}`);
  const sinLlave = await fetch(`${URL_BASE}/auth/v1/health`);
  anotar('GET /auth/v1/health sin apikey', sinLlave.status === 401, `${sinLlave.status} (Kong exige la llave anon)`);

  const a = await anonimo();
  creados.push(a.id);
  const pa = payload(a.token);
  anotar(
    'alta anónima (POST /auth/v1/signup)',
    pa.role === 'authenticated' && pa.is_anonymous === true,
    `JWT role=${pa.role} is_anonymous=${pa.is_anonymous} vence en ${pa.exp - pa.iat} s`,
  );
  const b = await anonimo();
  creados.push(b.id);

  // ── PostgREST + RLS ──
  const consent = await http('POST', '/rest/v1/consentimiento', {
    token: a.token,
    cuerpo: { version_aviso: 'prueba-backend', aceptado_en: new Date().toISOString() },
    encabezados: { Prefer: 'return=minimal' },
  });
  anotar('RLS permitido: A inserta su consentimiento', consent.estado === 201, `${consent.estado}`);
  const leerConsent = await http('GET', '/rest/v1/consentimiento?select=version_aviso', { token: a.token });
  anotar('RLS prohibido: A lee consentimiento', leerConsent.estado === 401 || leerConsent.estado === 403, `${leerConsent.estado} ${leerConsent.json?.code ?? ''}`);
  const ajeno = await http('POST', '/rest/v1/consentimiento', {
    token: a.token,
    cuerpo: { usuario_id: b.id, version_aviso: 'prueba-ajena', aceptado_en: new Date().toISOString() },
    encabezados: { Prefer: 'return=minimal' },
  });
  anotar('RLS prohibido: A inserta consentimiento a nombre de B', ajeno.estado === 401 || ajeno.estado === 403, `${ajeno.estado} ${ajeno.json?.code ?? ''}`);

  // ── compartido (función + RLS por pertenencia) ──
  const grupo = await http('POST', '/functions/v1/compartido/grupos', { token: a.token });
  const grupoId = grupo.json?.grupo_id;
  anotar('POST /functions/v1/compartido/grupos', grupo.estado === 200 && !!grupoId && !!grupo.json?.codigo_union, `${grupo.estado} ${grupoId ? 'grupo creado' : codigo(grupo)}`);
  if (grupoId) {
    const propios = await http('GET', `/rest/v1/miembros_compartidos?grupo_id=eq.${grupoId}&select=autor`, { token: a.token });
    anotar('RLS permitido: A lee los miembros de su grupo', propios.estado === 200 && propios.json?.length === 1, `${propios.estado} filas=${propios.json?.length}`);
    const otros = await http('GET', `/rest/v1/miembros_compartidos?grupo_id=eq.${grupoId}&select=autor`, { token: b.token });
    anotar('RLS prohibido: B lee los miembros del grupo de A', otros.estado === 200 && otros.json?.length === 0, `${otros.estado} filas=${otros.json?.length}`);
    const evento = await http('POST', '/rest/v1/eventos_compartidos', {
      token: b.token,
      cuerpo: { grupo_id: grupoId, id: randomUUID(), autor: 'a', blob: randomBytes(48).toString('base64') },
      encabezados: { Prefer: 'return=minimal' },
    });
    anotar('RLS prohibido: B publica en el grupo de A', evento.estado === 401 || evento.estado === 403, `${evento.estado} ${evento.json?.code ?? ''}`);
    const ajenoFn = await http('GET', `/functions/v1/compartido/eventos?grupo_id=${grupoId}`, { token: b.token });
    anotar('compartido: B descarga eventos del grupo de A', ajenoFn.estado === 403 && codigo(ajenoFn) === 'no_miembro', `${ajenoFn.estado} ${codigo(ajenoFn)}`);
    const salir = await http('POST', '/functions/v1/compartido/salir', { token: a.token, cuerpo: { grupo_id: grupoId } });
    anotar('compartido: A cierra el grupo', salir.estado === 200, `${salir.estado}`);
    // El grupo no se borra en cascada con los usuarios: se quita aquí (service role).
    await http('DELETE', `/rest/v1/grupos_compartidos?id=eq.${grupoId}`, { llave: SERVICIO });
  }

  // ── Funciones: JWT del enrutador ──
  const sinJwt = await http('POST', '/functions/v1/nlu-interpretar', { token: null, cuerpo: {} });
  anotar('nlu-interpretar sin Authorization', sinJwt.estado === 401, `${sinJwt.estado} ${codigo(sinJwt)}`);

  // ── Intérprete (Claude por la puerta de IA) ──
  if (!SIN_IA) {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const dia = dias[new Date(`${hoy}T12:00:00Z`).getUTCDay()];
    const nlu = await http('POST', '/functions/v1/nlu-interpretar', {
      token: a.token,
      cuerpo: {
        texto: 'unas micheladas de 80 con la Nu y una coca de 25 en efectivo',
        contexto_min: {
          fecha_referencia: hoy,
          dia_semana: dia,
          espacios: ['personal'],
          cuentas: [
            { tipo: 'credito', alias: ['nu'] },
            { tipo: 'efectivo', alias: ['efectivo'] },
          ],
        },
        version_esquema: 1,
      },
    });
    const i = nlu.json?.interpretacion;
    const resumen = i
      ? `intencion=${i.intencion}${i.motivo ? ` motivo=${i.motivo}` : ''}${Array.isArray(i.movimientos) ? ` movimientos=${i.movimientos.length}` : ''} proveedor=${nlu.json.proveedor} modelo=${nlu.json.modelo} tokens=${nlu.json.tokens_entrada}/${nlu.json.tokens_salida} latencia=${nlu.json.latencia_ms} ms`
      : codigo(nlu);
    anotar('POST /functions/v1/nlu-interpretar (frase de nivel nube)', nlu.estado === 200 && !!i, `${nlu.estado} ${resumen}`);
    if (i) console.log(`      interpretación: ${JSON.stringify(i)}`);
    const turno = await http('POST', '/functions/v1/llm-turno', {
      token: a.token,
      cuerpo: {
        mensajes: [{ rol: 'usuario', texto: '¿en qué gasto más?' }],
        herramientas: [{ nombre: 'mayores_gastos', descripcion: 'Top de gastos', parametros: { type: 'object', properties: {} } }],
      },
    });
    anotar('llm-turno con usuario Gratis', turno.estado === 403 && codigo(turno) === 'solo_plus', `${turno.estado} ${codigo(turno)}`);
    // Plus de prueba por una hora (la fila se va en cascada al borrar el usuario).
    const plus = await http('POST', '/rest/v1/derechos', {
      llave: SERVICIO,
      cuerpo: { usuario_id: a.id, plan: 'plus', vigente_hasta: new Date(Date.now() + 3600_000).toISOString() },
      encabezados: { Prefer: 'return=minimal' },
    });
    const turnoPlus = await http('POST', '/functions/v1/llm-turno', {
      token: a.token,
      cuerpo: {
        mensajes: [{ rol: 'usuario', texto: '¿en qué gasto más?' }],
        herramientas: [{ nombre: 'mayores_gastos', descripcion: 'Top de gastos', parametros: { type: 'object', properties: {} } }],
      },
    });
    const salida = turnoPlus.json?.salida;
    anotar(
      'llm-turno con usuario Plus (Claude con herramientas)',
      plus.estado === 201 && turnoPlus.estado === 200 && !!salida,
      `${plus.estado}/${turnoPlus.estado} ${salida ? `salida=${salida.tipo} proveedor=${turnoPlus.json.proveedor} modelo=${turnoPlus.json.modelo} latencia=${turnoPlus.json.latencia_ms} ms` : codigo(turnoPlus)}`,
    );
  }

  // ── Respaldo (sesión de correo; Storage con URLs firmadas) ──
  const anonResp = await http('GET', '/functions/v1/respaldo/lista', { token: a.token });
  anotar('respaldo con sesión anónima', anonResp.estado === 403 && codigo(anonResp) === 'sin_correo', `${anonResp.estado} ${codigo(anonResp)}`);
  const correo = `prueba-respaldo-${randomBytes(4).toString('hex')}@example.com`;
  const clave = randomBytes(18).toString('base64url');
  const alta = await http('POST', '/auth/v1/admin/users', {
    llave: SERVICIO,
    cuerpo: { email: correo, password: clave, email_confirm: true },
  });
  if (alta.estado === 200 && alta.json?.id) creados.push(alta.json.id);
  const sesion = await http('POST', '/auth/v1/token?grant_type=password', { cuerpo: { email: correo, password: clave } });
  const tc = sesion.json?.access_token;
  anotar('sesión de correo de prueba (admin + password)', !!tc && payload(tc).is_anonymous === false, `${alta.estado}/${sesion.estado}`);
  if (tc) {
    const url = await http('POST', '/functions/v1/respaldo/url', { token: tc, cuerpo: { operacion: 'subir', version: 1 } });
    const firmada = url.json?.url ?? '';
    const deStorage = firmada.startsWith(`${URL_BASE}/storage/v1/`);
    anotar('respaldo: URL firmada de subida', url.estado === 200 && deStorage, `${url.estado} ${deStorage ? 'con el dominio público' : `URL inesperada ${codigo(url)}`}`);
    const datos = randomBytes(1024);
    if (deStorage) {
      const put = await http('PUT', firmada, {
        token: null,
        llave: '',
        crudo: datos,
        encabezados: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' },
      });
      anotar('respaldo: PUT de 1 KB', put.estado >= 200 && put.estado < 300, `${put.estado}`);
      const lista = await http('GET', '/functions/v1/respaldo/lista', { token: tc });
      const r0 = lista.json?.respaldos?.find((x) => x.nombre === url.json.nombre);
      anotar('respaldo: lista', lista.estado === 200 && r0?.tamano === 1024, `${lista.estado} respaldos=${lista.json?.respaldos?.length} tamano=${r0?.tamano}`);
      const baj = await http('POST', '/functions/v1/respaldo/url', { token: tc, cuerpo: { operacion: 'bajar', nombre: url.json.nombre } });
      const get = baj.json?.url ? await http('GET', baj.json.url, { token: null, llave: '' }) : null;
      anotar('respaldo: bajar y comparar', !!get && get.estado === 200 && Buffer.compare(get.bytes, datos) === 0, `${baj.estado}/${get?.estado} ${get && Buffer.compare(get.bytes, datos) === 0 ? 'bytes idénticos' : 'distintos'}`);
    }
    const borrar = await http('DELETE', '/functions/v1/respaldo/cuenta', { token: tc });
    anotar('respaldo: borrar cuenta (archivos + usuario)', borrar.estado === 200 && borrar.json?.resultado === 'borrada', `${borrar.estado} ${borrar.json?.resultado ?? codigo(borrar)}`);
    if (borrar.estado === 200) {
      const ya = await http('GET', `/auth/v1/admin/users/${alta.json.id}`, { llave: SERVICIO });
      anotar('respaldo: el usuario de correo ya no existe', ya.estado === 404, `${ya.estado}`);
    }
  }

  // ── Plantillas (bucket público) ──
  const plantillas = await http('GET', '/storage/v1/object/public/plantillas/plantillas.json', { token: null, llave: '' });
  anotar('bucket público plantillas responde', plantillas.estado === 200 || plantillas.estado === 400 || plantillas.estado === 404, `${plantillas.estado} ${plantillas.estado === 200 ? '' : '(aún sin plantillas.json publicado)'}`);

  // ── lista-espera (sin JWT) ──
  const pre = await fetch(`${URL_BASE}/functions/v1/lista-espera`, { method: 'OPTIONS', headers: { Origin: 'https://finanvoz.com' } });
  anotar('lista-espera OPTIONS (CORS solo de la calculadora)', pre.status === 204 && pre.headers.get('access-control-allow-origin') === 'https://finanvoz.com',`${pre.status} allow-origin=${pre.headers.get('access-control-allow-origin')}`);
  const bot = await http('POST', '/functions/v1/lista-espera', { token: null, cuerpo: { sitio_web: 'x' } });
  anotar('lista-espera campo trampa', bot.estado === 200 && bot.json?.ok === true, `${bot.estado}`);
  const malo = await http('POST', '/functions/v1/lista-espera', { token: null, cuerpo: {} });
  anotar('lista-espera sin consentimiento', malo.estado === 400, `${malo.estado} ${malo.json?.codigo ?? ''}`);
  const correoLe = `prueba-lista-${randomBytes(4).toString('hex')}@example.com`;
  const le = await http('POST', '/functions/v1/lista-espera', {
    token: null,
    cuerpo: {
      correo: correoLe,
      consentimiento: true,
      version_aviso: 'prueba-backend',
      respuestas: { telefono: 'android', notificaciones: 'si', precio: 'hasta_49', uso: 'personal' },
    },
  });
  anotar('lista-espera registro real (RPC en la base)', le.estado === 200 && le.json?.ok === true, `${le.estado} ${le.json?.codigo ?? ''}`);
  const borrarLe = await http('DELETE', `/rest/v1/lista_espera?correo=eq.${encodeURIComponent(correoLe)}`, {
    llave: SERVICIO,
    encabezados: { Prefer: 'return=representation' },
  });
  anotar('lista-espera: se borra el registro de prueba', borrarLe.estado === 200 && borrarLe.json?.length === 1, `${borrarLe.estado} filas=${borrarLe.json?.length}`);

  // ── webhooks-revenuecat (sin JWT; lo protege su secreto) ──
  const rc = await http('POST', '/functions/v1/webhooks-revenuecat', { token: null, cuerpo: {} });
  anotar('webhooks-revenuecat sin secreto', rc.estado === 401, `${rc.estado} ${codigo(rc)}`);
}

try {
  await main();
} catch (e) {
  anotar('ejecución', false, e instanceof Error ? e.message : String(e));
} finally {
  await limpiar();
}
const fallas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallas}/${resultados.length} pruebas bien`);
process.exit(fallas === 0 ? 0 : 1);
