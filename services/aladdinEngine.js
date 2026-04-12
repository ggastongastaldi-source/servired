// ============================================
// MOTOR ALADÍN - Método Briones
// Presupuesto indexado al Combo Big Mac ARS
// Protege el valor del trabajo contra la inflación
// Actualizado: Abril 2026
// ============================================

class AladdinEngine {
  constructor() {

    // Precio combo Big Mac Argentina - Abril 2026
    this.VALOR_BASE_COMBO_ARS = 6500;

    // Coeficientes por rubro y complejidad
    this.COEFICIENTES = {
      albanileria:            { baja: 15.0,  alta: 80.0  },
      plomeria:               { baja: 12.0,  alta: 60.0  },
      electricidad:           { baja: 12.0,  alta: 65.0  },
      limpieza_hogar:         { baja: 1.5,   alta: 5.0   },
      pintura:                { baja: 10.0,  alta: 40.0  },
      gasista:                { baja: 14.0,  alta: 70.0  },
      cerrajeria:             { baja: 1.2,   alta: 4.0   },
      aire_acondicionado:     { baja: 2.5,   alta: 8.0   },
      durlock:                { baja: 14.0,  alta: 55.0  },
      impermeabilizacion:     { baja: 2.5,   alta: 10.0  },
      zingueria:              { baja: 2.0,   alta: 8.0   },
      construccion_seco:      { baja: 2.0,   alta: 10.0  },
      pisos_revestimientos:   { baja: 2.5,   alta: 9.0   },
      herreria:               { baja: 2.0,   alta: 8.0   },
      carpinteria:            { baja: 1.8,   alta: 7.0   },
      vidrieria:              { baja: 1.5,   alta: 5.0   },
      techista:               { baja: 2.5,   alta: 11.0  },
      jardineria:             { baja: 1.2,   alta: 4.0   },
      fletes_mudanzas:        { baja: 2.0,   alta: 6.0   },
      reparacion_celulares:   { baja: 1.0,   alta: 3.0   },
      servicio_tecnico_pc:    { baja: 1.2,   alta: 4.0   },
      cuidado_personas:       { baja: 1.0,   alta: 3.5   },
      peluqueria_domicilio:   { baja: 1.0,   alta: 2.5   },
      mecanica_ligera:        { baja: 1.5,   alta: 5.0   },
      costura_arreglos:       { baja: 0.8,   alta: 2.5   },
      desinfeccion_plagas:    { baja: 2.0,   alta: 6.0   },
      servicio_domestico:     { baja: 1.5,   alta: 4.0   },
    };
  }

  calcularPresupuesto(rubroKey, complejidad = 'baja', complejidadAdicional = 1.0) {
    const rubro = this.COEFICIENTES[rubroKey];
    if (!rubro) throw new Error(`Aladdín: rubro [${rubroKey}] no clasificado.`);

    const nivel = complejidad === 'alta' ? 'alta' : 'baja';
    const coef  = rubro[nivel];

    // FÓRMULA MAESTRA BRIONES
    const precioTotal    = Math.round(this.VALOR_BASE_COMBO_ARS * coef * complejidadAdicional);
    const comision       = Math.round(precioTotal * 0.20);
    const pagoTrabajador = precioTotal - comision;

    return {
      rubro:           rubroKey,
      complejidad:     nivel,
      precio_total:    precioTotal,
      comision:        comision,
      pago_trabajador: pagoTrabajador,
      big_mac_base:    this.VALOR_BASE_COMBO_ARS,
      coeficiente:     coef,
    };
  }

  setValorBaseARS(nuevoValor) {
    this.VALOR_BASE_COMBO_ARS = nuevoValor;
    console.log(`[Aladdín] Índice Big Mac actualizado: ${nuevoValor} ARS`);
  }

  listarRubros() {
    return Object.keys(this.COEFICIENTES);
  }
}

module.exports = new AladdinEngine();
