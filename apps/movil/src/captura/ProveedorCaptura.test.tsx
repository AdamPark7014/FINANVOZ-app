import { render, screen, waitFor } from '@testing-library/react-native';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Text } from 'react-native';
import type { FetchNube, RespuestaNube } from '../nube/http';
import { abrirPruebaPantalla } from '../pantallas/principal/__pruebas__/base';
import { ProveedorSesion } from '../sesion/ProveedorSesion';
import type { DependenciasPlantillas } from './actualizar-plantillas';
import { fijarPlantillasRemotas } from './catalogo';
import { ProveedorCaptura, useCaptura } from './ProveedorCaptura';
import type { PuenteCaptura } from './tipos';

/**
 * CA-M10-03 en la app (jest-expo, Hermes no): con la llave pública de prueba configurada, el proveedor de captura
 * baja `fixtures/plantillas-firmadas/plantillas.json`, lo activa en el catálogo de JS y en el módulo nativo; sin
 * red sigue con las embebidas; con un byte cambiado, también.
 */
const DIR = join(__dirname, '../../../../fixtures/plantillas-firmadas');
const ARCHIVO = new Uint8Array(readFileSync(join(DIR, 'plantillas.json')));
const FIRMA = readFileSync(join(DIR, 'plantillas.json.sig'), 'utf8');
const kat = JSON.parse(readFileSync(join(DIR, 'kat.json'), 'utf8')) as { llave_publica_hex: string };
const URL_JSON = 'https://proyecto.supabase.co/storage/v1/object/public/plantillas/plantillas.json';
const sha256 = async (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function respuesta(status: number, cuerpo: Uint8Array): RespuestaNube {
  return {
    status,
    headers: { get: () => null },
    json: async () => null,
    arrayBuffer: async () => cuerpo.slice().buffer,
  };
}

function deps(bytes: Uint8Array | null): DependenciasPlantillas {
  const fetch: FetchNube = async (url) => {
    if (bytes === null) throw new TypeError('Network request failed');
    if (url === URL_JSON) return respuesta(200, bytes);
    return respuesta(200, new Uint8Array(Buffer.from(FIRMA)));
  };
  return {
    fetch,
    url: URL_JSON,
    llaves: [{ id: 'prueba-rfc8032', llavePublicaHex: kat.llave_publica_hex }],
    versionApp: '1.0.0',
  };
}

function puenteFalso() {
  return {
    disponible: () => true,
    esDepuracion: () => true,
    leerCola: jest.fn(async () => []),
    confirmarProcesadas: jest.fn(async () => 0),
    suscribirse: jest.fn(() => () => {}),
    estadoPermiso: jest.fn(async () => 'concedido'),
    appsBancariasInstaladas: jest.fn(async () => []),
    ultimoEvento: jest.fn(async () => null),
    fijarCatalogoRemoto: jest.fn(async () => true),
  } as unknown as PuenteCaptura & { fijarCatalogoRemoto: jest.Mock };
}

function VersionCatalogo() {
  const { catalogo } = useCaptura();
  return <Text>{`version ${catalogo.version}`}</Text>;
}

function montar(remotas: DependenciasPlantillas | null, puente = puenteFalso()) {
  const prueba = abrirPruebaPantalla();
  render(
    <ProveedorSesion ctx={prueba.ctx}>
      <ProveedorCaptura puente={puente} sha256={sha256} plantillasRemotas={remotas}>
        <VersionCatalogo />
      </ProveedorCaptura>
    </ProveedorSesion>,
  );
  return { prueba, puente };
}

afterEach(() => fijarPlantillasRemotas(null));

describe('plantillas remotas en la captura (CA-M10-03)', () => {
  it('acepta el archivo firmado y lo usa el catálogo de JS y el módulo nativo', async () => {
    const { puente, prueba } = montar(deps(ARCHIVO));
    await screen.findByText('version 2');
    const bancos = (JSON.parse(Buffer.from(ARCHIVO).toString('utf8')) as { bancos: unknown[] }).bancos;
    await waitFor(() => expect(puente.fijarCatalogoRemoto).toHaveBeenLastCalledWith(bancos));
    prueba.cerrar();
  });

  it('sin red sigue con las plantillas embebidas', async () => {
    const { puente, prueba } = montar(deps(null));
    await waitFor(() => expect(puente.fijarCatalogoRemoto).toHaveBeenCalledWith(null));
    expect(screen.getByText('version 1')).toBeTruthy();
    prueba.cerrar();
  });

  it('un byte cambiado se rechaza y quedan las embebidas', async () => {
    const alterado = ARCHIVO.slice();
    alterado[10] = (alterado[10] ?? 0) ^ 0x01;
    const { puente, prueba } = montar(deps(alterado));
    await waitFor(() => expect(puente.fijarCatalogoRemoto).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('version 1')).toBeTruthy();
    expect(puente.fijarCatalogoRemoto).not.toHaveBeenCalledWith(expect.arrayContaining([expect.anything()]));
    prueba.cerrar();
  });

  it('un build sin llaves no descarga y deja al módulo nativo con su catálogo embebido', async () => {
    const { puente, prueba } = montar(null);
    await waitFor(() => expect(puente.fijarCatalogoRemoto).toHaveBeenCalledWith(null));
    expect(screen.getByText('version 1')).toBeTruthy();
    prueba.cerrar();
  });
});
