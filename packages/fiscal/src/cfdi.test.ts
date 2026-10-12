import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decimalACentavos, parsearCfdi } from './index';

const raiz = (ruta: string) => fileURLToPath(new URL(`../../../${ruta}`, import.meta.url));

interface VectoresE13 {
  decimal_a_centavos: { entrada: string; esperado: number }[];
  parsear: { archivo: string; esperado: Record<string, unknown> }[];
}
const e13 = (JSON.parse(readFileSync(raiz('fixtures/motores/vectores.json'), 'utf8')) as { E13: VectoresE13 })
  .E13;
const leer = (archivo: string) => readFileSync(raiz(archivo), 'utf8');

const codigoDe = (f: () => unknown): string | null => {
  try {
    f();
  } catch (e) {
    return (e as { codigo?: string }).codigo ?? 'sin_codigo';
  }
  return null;
};

describe('E13.1 decimalACentavos', () => {
  it('carga los vectores', () => expect(e13.decimal_a_centavos.length).toBe(6));

  for (const v of e13.decimal_a_centavos) {
    it(`E13.decimal_a_centavos "${v.entrada}" → ${v.esperado}`, () => {
      expect(decimalACentavos(v.entrada)).toBe(v.esperado);
    });
  }

  it('negativos, espacios y ceros', () => {
    expect(decimalACentavos(' -12.345 ')).toBe(-1235);
    expect(decimalACentavos('-0.001')).toBe(0);
    expect(Object.is(decimalACentavos('-0.001'), 0)).toBe(true);
    expect(decimalACentavos('0')).toBe(0);
    expect(decimalACentavos('99999999999.999999')).toBe(10000000000000);
  });

  it('rechaza formatos que no son importes del CFDI', () => {
    for (const s of [
      '',
      '1,160.00',
      '1.1234567',
      '.5',
      '5.',
      '1e3',
      '+5',
      'abc',
      '0x10',
      '99999999999999999999',
    ]) {
      expect(
        codigoDe(() => decimalACentavos(s)),
        s,
      ).toBe('importe_invalido');
    }
  });
});

describe('E13.1 parsearCfdi', () => {
  it('cubre los 9 archivos de fixtures/cfdi', () => expect(e13.parsear).toHaveLength(9));

  for (const v of e13.parsear) {
    it(`E13.parsear ${v.archivo}`, () => {
      const xml = leer(v.archivo);
      if ('error' in v.esperado) {
        expect(codigoDe(() => parsearCfdi(xml))).toBe(v.esperado['error']);
      } else {
        expect(parsearCfdi(xml)).toEqual(v.esperado);
      }
    });
  }

  const c03 = leer('fixtures/cfdi/c03_lentes_tarjeta.xml');

  it('el rechazo del 3.3 es un ErrorDominio tipado', () => {
    try {
      parsearCfdi(leer('fixtures/cfdi/c09_version_33.xml'));
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ name: 'ErrorDominio', codigo: 'version_no_soportada' });
    }
  });

  it('resuelve los espacios de nombres, no los prefijos', () => {
    const otroPrefijo = c03.replaceAll('cfdi:', 'c4:').replace('xmlns:cfdi=', 'xmlns:c4=');
    expect(parsearCfdi(otroPrefijo)).toEqual(parsearCfdi(c03));
    // Espacio de nombres por omisión, sin prefijo.
    const sinPrefijo = c03.replaceAll('cfdi:', '').replace('xmlns:cfdi=', 'xmlns=');
    expect(parsearCfdi(sinPrefijo)).toEqual(parsearCfdi(c03));
    // El prefijo cfdi apuntando a otro espacio de nombres no es un CFDI 4.0.
    const engañoso = c03.replace('http://www.sat.gob.mx/cfd/4', 'http://www.sat.gob.mx/cfd/3');
    expect(codigoDe(() => parsearCfdi(engañoso))).toBe('version_no_soportada');
  });

  it('con BOM, entidades XML y referencias numéricas', () => {
    const xml = '\uFEFF' + c03.replace('OPTICA FICTICIA', 'OPTICA &amp; CIA &#xC9;');
    expect(parsearCfdi(xml).emisor_nombre).toBe('OPTICA & CIA É');
  });

  it('sin timbre fiscal', () => {
    const sinTimbre = c03.replace(/<tfd:TimbreFiscalDigital[^>]*\/>/, '');
    expect(codigoDe(() => parsearCfdi(sinTimbre))).toBe('sin_timbre');
    const sinComplemento = c03.replace(/<cfdi:Complemento>[\s\S]*<\/cfdi:Complemento>/, '');
    expect(codigoDe(() => parsearCfdi(sinComplemento))).toBe('sin_timbre');
  });

  it('IVA: solo traslados 002 con importe del nodo Impuestos del comprobante', () => {
    const conIeps = c03.replace(
      '</cfdi:Traslados>\n  </cfdi:Impuestos>\n  <cfdi:Complemento>',
      '<cfdi:Traslado Base="1" Impuesto="003" TipoFactor="Tasa" TasaOCuota="0.08" Importe="10.00"/>' +
        '<cfdi:Traslado Base="1" Impuesto="002" TipoFactor="Exento"/>' +
        '<cfdi:Traslado Base="1" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.16" Importe="0.16"/>' +
        '</cfdi:Traslados>\n  </cfdi:Impuestos>\n  <cfdi:Complemento>',
    );
    expect(parsearCfdi(conIeps).iva_trasladado).toBe(44138 + 16);
    const sinImpuestos = c03.replace(
      /<cfdi:Impuestos TotalImpuestos[\s\S]*?<\/cfdi:Impuestos>\n {2}<cfdi:Complemento>/,
      '<cfdi:Complemento>',
    );
    expect(parsearCfdi(sinImpuestos).iva_trasladado).toBe(0);
  });

  it('atributos opcionales ausentes quedan en null', () => {
    const xml = c03
      .replace(' FormaPago="04"', '')
      .replace(' MetodoPago="PUE"', '')
      .replace(' Moneda="MXN"', '')
      .replace(' Nombre="OPTICA FICTICIA"', '')
      .replace(' UsoCFDI="D01"', '');
    expect(parsearCfdi(xml)).toMatchObject({
      forma_pago: null,
      metodo_pago: null,
      moneda: null,
      emisor_nombre: null,
      uso_cfdi: null,
    });
  });

  it('XML mal formado, con DOCTYPE o que no es un CFDI', () => {
    expect(codigoDe(() => parsearCfdi('<cfdi:Comprobante'))).toBe('xml_invalido');
    expect(codigoDe(() => parsearCfdi(''))).toBe('xml_invalido');
    const conDoctype = c03.replace(
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]>',
    );
    expect(codigoDe(() => parsearCfdi(conDoctype))).toBe('xml_invalido');
    expect(codigoDe(() => parsearCfdi('<factura xmlns="http://www.sat.gob.mx/cfd/4"/>'))).toBe('no_es_cfdi');
    expect(codigoDe(() => parsearCfdi('<a/><b/>'))).toBe('xml_invalido');
  });

  it('faltan datos obligatorios o importes inválidos', () => {
    const casos = [
      c03.replace(' Total="3200.00"', ''),
      c03.replace(' Fecha="2026-05-20T12:00:00"', ' Fecha="20/05/2026"'),
      c03.replace(' TipoDeComprobante="I"', ''),
      c03.replace('<cfdi:Emisor Rfc="CCC030303CC3"', '<cfdi:Emisor'),
      c03.replace(/<cfdi:Receptor [^>]*\/>/, ''),
      c03.replace(' UUID="5a1b2c3d-0000-4000-8000-000000000003"', ''),
      c03
        .replace('<tfd:TimbreFiscalDigital', '<tfd:TimbreFiscalDigital Otro="1"')
        .replace('<cfdi:Complemento>', '<cfdi:Complemento><tfd:TimbreFiscalDigital UUID="X"/>'),
    ];
    for (const xml of casos) expect(codigoDe(() => parsearCfdi(xml))).toBe('cfdi_invalido');
    expect(codigoDe(() => parsearCfdi(c03.replace('Total="3200.00"', 'Total="3,200.00"')))).toBe(
      'importe_invalido',
    );
  });
});
