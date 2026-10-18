#!/usr/bin/env node
// Pendiente 57 · Borra usuarios anónimos huérfanos en Supabase Auth (Adam, manual o cron externo).
// Requiere migración `20261301000000_anonimos_sin_uso.sql` (`supabase db push`).
//
//   cd services/proxy
//   $env:SUPABASE_URL="https://<ref>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<service role>"   # nunca al repositorio
//   node scripts/limpiar-anonimos.mjs                 # simulación, 90 días
//   node scripts/limpiar-anonimos.mjs --dias 120 --verbose
//   node scripts/limpiar-anonimos.mjs --dias 90 --borrar
//
// Privacidad: sin montos ni texto de usuario; solo conteos y, con --verbose, ids uuid (auditoría).

const env = (nombre) => process.env[nombre]?.trim() || '';

function parseArgs(argv) {
  let dias = 90;
  let borrar = false;
  let verbose = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--borrar') borrar = true;
    else if (a === '--verbose') verbose = true;
    else if (a === '--dias') {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1) throw new Error('--dias debe ser un entero >= 1');
      dias = Math.floor(n);
    } else if (a === '--help' || a === '-h') {
      console.log(`Uso: node scripts/limpiar-anonimos.mjs [--dias N] [--borrar] [--verbose]
Simulación por defecto. Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.`);
      process.exit(0);
    } else throw new Error(`Argumento desconocido: ${a}`);
  }
  return { dias, borrar, verbose };
}

async function listarCandidatos(url, llave, dias) {
  const res = await fetch(`${url}/rest/v1/rpc/anonimos_sin_uso_candidatos`, {
    method: 'POST',
    headers: {
      apikey: llave,
      Authorization: `Bearer ${llave}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ p_inactivo_dias: dias }),
  });
  if (!res.ok) {
    const cuerpo = await res.text();
    throw new Error(`RPC anonimos_sin_uso_candidatos: HTTP ${res.status} ${cuerpo.slice(0, 200)}`);
  }
  return /** @type {{ usuario_id: string; inactivo_desde: string }[]} */ (await res.json());
}

async function borrarUsuario(url, llave, usuarioId) {
  const res = await fetch(`${url}/auth/v1/admin/users/${usuarioId}`, {
    method: 'DELETE',
    headers: {
      apikey: llave,
      Authorization: `Bearer ${llave}`,
    },
  });
  if (!res.ok) {
    const cuerpo = await res.text();
    throw new Error(`deleteUser ${usuarioId}: HTTP ${res.status} ${cuerpo.slice(0, 120)}`);
  }
}

async function main() {
  const { dias, borrar, verbose } = parseArgs(process.argv.slice(2));
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const llave = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !llave) {
    console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (Settings → API del proyecto).');
    process.exit(1);
  }

  const candidatos = await listarCandidatos(url, llave, dias);
  console.log(
    JSON.stringify({
      modo: borrar ? 'borrar' : 'simular',
      inactivo_dias: dias,
      candidatos: candidatos.length,
    }),
  );

  if (verbose && candidatos.length > 0) {
    for (const c of candidatos) {
      console.log(JSON.stringify({ usuario_id: c.usuario_id, inactivo_desde: c.inactivo_desde }));
    }
  }

  if (!borrar) {
    if (candidatos.length > 0) {
      console.error('Simulación: no se borró nada. Repite con --borrar si la lista es la esperada.');
    }
    return;
  }

  let ok = 0;
  let fallos = 0;
  for (const c of candidatos) {
    try {
      await borrarUsuario(url, llave, c.usuario_id);
      ok++;
    } catch (e) {
      fallos++;
      console.error(String(e instanceof Error ? e.message : e));
    }
  }
  console.log(JSON.stringify({ borrados: ok, fallos }));
  if (fallos > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
