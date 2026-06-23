import { ControladorAlmacen } from '../src/application/ControladorAlmacen';
import { Almacen } from '../src/domain/entities/Almacen';
import { Celda } from '../src/domain/entities/Celda';
import { Robot } from '../src/domain/entities/Robot';
import { EstadoRobot } from '../src/domain/enums/EstadoRobot';
import { TipoCelda } from '../src/domain/enums/TipoCelda';
import { CamionDTO, MapaConfigDTO, RobotConfigDTO } from '../src/infrastructure/dtos';

function crearMapa(): MapaConfigDTO {
  return {
    dimensiones: { width: 6, height: 6 },
    estanterias: [{ x: 3, y: 3 }, { x: 4, y: 3 }],
    muelles: [{ x: 0, y: 2, id: 'M1' }, { x: 5, y: 2, id: 'M2' }],
    basesCarga: [{ x: 0, y: 0, id: 'B1' }],
  };
}

function crearRobots(): RobotConfigDTO[] {
  return [{ id: 'R1', x: 1, y: 2, bateria: 100 }];
}

function avanzar(controlador: ControladorAlmacen, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    controlador.procesarPaso();
  }
}

function crearControladorParaPrioridades(): ControladorAlmacen {
  const controlador = new ControladorAlmacen();
  controlador.inicializar(
    {
      dimensiones: { width: 8, height: 5 },
      estanterias: [{ x: 3, y: 2 }, { x: 4, y: 2 }],
      muelles: [{ x: 0, y: 2, id: 'M1' }, { x: 7, y: 2, id: 'M2' }],
      basesCarga: [{ x: 7, y: 4, id: 'B1' }],
    },
    [{ id: 'R1', x: 1, y: 2, bateria: 100 }]
  );
  return controlador;
}

function avanzarHastaCantidadPaquetes(
  controlador: ControladorAlmacen,
  cantidadEsperada: number,
  maxTicks: number = 80
): any {
  for (let i = 0; i < maxTicks; i++) {
    controlador.procesarPaso();
    const estado = controlador.obtenerEstado() as any;
    if (paquetesEnEstanterias(estado).length === cantidadEsperada) {
      return estado;
    }
  }

  return controlador.obtenerEstado();
}

function paquetesEnEstanterias(estado: any): any[] {
  return estado.estanterias.flatMap((estanteria: any) => estanteria.paquetes);
}

describe('ControladorAlmacen', () => {
  test('inicializa el estado visible del almacen', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(crearMapa(), crearRobots());

    const estado = controlador.obtenerEstado() as any;

    expect(estado.dimensiones).toEqual({ width: 6, height: 6 });
    expect(estado.robots).toHaveLength(1);
    expect(estado.estanterias).toHaveLength(2);
    expect(estado.basesCarga).toHaveLength(1);
  });

  test('respeta el delay de un tick antes de liberar ordenes de un camion recien llegado', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(crearMapa(), crearRobots());
    controlador.onCamionLlega(camionRecepcion(1));

    controlador.procesarPaso();
    let estado = controlador.obtenerEstado() as any;
    expect(estado.robots[0].estado).toBe('INACTIVO');

    controlador.procesarPaso();
    estado = controlador.obtenerEstado() as any;
    expect(estado.robots[0].estado).toBe('OPERANDO');
  });

  test('almacena un paquete de recepcion en una estanteria', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(crearMapa(), crearRobots());
    controlador.onCamionLlega(camionRecepcion(1));

    avanzar(controlador, 20);

    const estado = controlador.obtenerEstado() as any;
    const paquetesEnEstanterias = estado.estanterias.reduce(
      (total: number, estanteria: any) => total + estanteria.paquetes.length,
      0
    );
    expect(paquetesEnEstanterias).toBe(1);
    expect(estado.camiones).toHaveLength(0);
  });

  test('despacha un paquete previamente almacenado', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(crearMapa(), crearRobots());
    controlador.onCamionLlega(camionRecepcion(1));
    avanzar(controlador, 20);

    controlador.onCamionLlega(camionDespacho(21));
    avanzar(controlador, 30);

    const estado = controlador.obtenerEstado() as any;
    const paquetesEnEstanterias = estado.estanterias.reduce(
      (total: number, estanteria: any) => total + estanteria.paquetes.length,
      0
    );
    expect(paquetesEnEstanterias).toBe(0);
    expect(estado.camiones).toHaveLength(0);
  });

  test('no retira el camion si el robot sigue posicionado sobre el muelle', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(crearMapa(), crearRobots());
    controlador.onCamionLlega(camionRecepcion(1));
    avanzar(controlador, 20);

    controlador.onCamionLlega(camionDespacho(21));

    let estado: any = null;
    for (let i = 0; i < 30; i++) {
      controlador.procesarPaso();
      estado = controlador.obtenerEstado() as any;
      const robot = estado.robots[0];
      if (robot.x === 5 && robot.y === 2 && robot.estado === 'INACTIVO' && !robot.carga) {
        break;
      }
    }

    expect(estado.robots[0]).toMatchObject({ x: 5, y: 2, estado: 'INACTIVO', carga: false });
    expect(estado.camiones).toHaveLength(1);
    expect(estado.camiones[0]).toMatchObject({ x: 5, y: 2, tipo: 'DESPACHO' });

    controlador.procesarPaso();
    estado = controlador.obtenerEstado() as any;
    expect(estado.robots[0]).not.toMatchObject({ x: 5, y: 2 });
    expect(estado.camiones).toHaveLength(1);

    controlador.procesarPaso();
    estado = controlador.obtenerEstado() as any;
    expect(estado.camiones).toHaveLength(0);
  });

  test('en sim1 el camion de despacho no se retira mientras un robot esta en su muelle', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(
      {
        dimensiones: { width: 10, height: 10 },
        estanterias: [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 5 }],
        muelles: [{ x: 0, y: 3, id: 'M1' }, { x: 9, y: 6, id: 'M2' }],
        basesCarga: [{ x: 0, y: 0, id: 'B1' }, { x: 9, y: 9, id: 'B2' }],
      },
      [
        { id: 'R1', x: 2, y: 2, bateria: 10 },
        { id: 'R2', x: 7, y: 7, bateria: 100 },
      ]
    );

    for (let tick = 1; tick <= 80; tick++) {
      if (tick === 2) {
        controlador.onCamionLlega(camionRecepcionSim1());
      }
      if (tick === 25) {
        controlador.onCamionLlega(camionDespachoSim1());
      }

      controlador.procesarPaso();
      const estado = controlador.obtenerEstado() as any;
      const hayRobotEnMuelleDespacho = estado.robots.some((robot: any) => robot.x === 9 && robot.y === 6);
      const camionDespachoPresente = estado.camiones.some((camion: any) => camion.x === 9 && camion.y === 6 && camion.tipo === 'DESPACHO');

      if (tick >= 25 && hayRobotEnMuelleDespacho) {
        expect(camionDespachoPresente).toBe(true);
      }
    }
  });

  test('si llega un camion a un muelle ocupado, espera y se acopla cuando queda libre', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(
      {
        dimensiones: { width: 7, height: 5 },
        estanterias: [{ x: 4, y: 1 }, { x: 4, y: 3 }],
        muelles: [{ x: 0, y: 2, id: 'M1' }],
        basesCarga: [{ x: 6, y: 4, id: 'B1' }],
      },
      [{ id: 'R1', x: 1, y: 2, bateria: 100 }]
    );

    controlador.onCamionLlega({
      id: 'C1',
      tipo: 'RECEPCION',
      muelleId: 'M1',
      tickLlegada: 1,
      ordenes: [
        {
          id: 'O1',
          camionId: 'C1',
          paqueteId: 'P1',
          tipoPaquete: 'GENERAL',
          peso: 20,
          vencimiento: null,
        },
      ],
    });
    controlador.procesarPaso();

    expect(() => controlador.onCamionLlega({
      id: 'C2',
      tipo: 'RECEPCION',
      muelleId: 'M1',
      tickLlegada: 2,
      ordenes: [
        {
          id: 'O2',
          camionId: 'C2',
          paqueteId: 'P2',
          tipoPaquete: 'GENERAL',
          peso: 30,
          vencimiento: null,
        },
      ],
    })).not.toThrow();

    avanzar(controlador, 30);

    const estado = controlador.obtenerEstado() as any;
    const paquetesEnEstanterias = estado.estanterias.reduce(
      (total: number, estanteria: any) => total + estanteria.paquetes.length,
      0
    );
    expect(paquetesEnEstanterias).toBe(2);
    expect(estado.camiones).toHaveLength(0);
  });

  test('prioriza paquetes generales de mayor peso', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(
      {
        dimensiones: { width: 7, height: 5 },
        estanterias: [{ x: 3, y: 2 }, { x: 4, y: 2 }],
        muelles: [{ x: 0, y: 2, id: 'M1' }],
        basesCarga: [{ x: 6, y: 4, id: 'B1' }],
      },
      [{ id: 'R1', x: 1, y: 2, bateria: 100 }]
    );

    controlador.onCamionLlega({
      id: 'C1',
      tipo: 'RECEPCION',
      muelleId: 'M1',
      tickLlegada: 1,
      ordenes: [
        {
          id: 'O1',
          camionId: 'C1',
          paqueteId: 'P_LIVIANO',
          tipoPaquete: 'GENERAL',
          peso: 10,
          vencimiento: null,
        },
        {
          id: 'O2',
          camionId: 'C1',
          paqueteId: 'P_PESADO',
          tipoPaquete: 'GENERAL',
          peso: 90,
          vencimiento: null,
        },
      ],
    });

    avanzar(controlador, 7);

    const estado = controlador.obtenerEstado() as any;
    const paquetesAlmacenados = estado.estanterias.flatMap((estanteria: any) => estanteria.paquetes);

    expect(paquetesAlmacenados).toHaveLength(1);
    expect(paquetesAlmacenados[0].id).toBe('P_PESADO');
  });

  test('prioriza paquetes comestibles sobre generales aunque el general pese mas', () => {
    const controlador = crearControladorParaPrioridades();
    controlador.onCamionLlega({
      id: 'C1',
      tipo: 'RECEPCION',
      muelleId: 'M1',
      tickLlegada: 1,
      ordenes: [
        {
          id: 'O1',
          camionId: 'C1',
          paqueteId: 'P_GENERAL_PESADO',
          tipoPaquete: 'GENERAL',
          peso: 999,
          vencimiento: null,
        },
        {
          id: 'O2',
          camionId: 'C1',
          paqueteId: 'P_COMESTIBLE',
          tipoPaquete: 'COMESTIBLE',
          peso: 1,
          vencimiento: '2026-10-01',
        },
      ],
    });

    const estado = avanzarHastaCantidadPaquetes(controlador, 1);
    const paquetesAlmacenados = paquetesEnEstanterias(estado);

    expect(paquetesAlmacenados[0].id).toBe('P_COMESTIBLE');
  });

  test('prioriza comestibles por FEFO', () => {
    const controlador = crearControladorParaPrioridades();
    controlador.onCamionLlega({
      id: 'C1',
      tipo: 'RECEPCION',
      muelleId: 'M1',
      tickLlegada: 1,
      ordenes: [
        {
          id: 'O1',
          camionId: 'C1',
          paqueteId: 'P_VENCE_DESPUES',
          tipoPaquete: 'COMESTIBLE',
          peso: 10,
          vencimiento: '2027-01-01',
        },
        {
          id: 'O2',
          camionId: 'C1',
          paqueteId: 'P_VENCE_ANTES',
          tipoPaquete: 'COMESTIBLE',
          peso: 10,
          vencimiento: '2026-01-01',
        },
      ],
    });

    const estado = avanzarHastaCantidadPaquetes(controlador, 1);
    const paquetesAlmacenados = paquetesEnEstanterias(estado);

    expect(paquetesAlmacenados[0].id).toBe('P_VENCE_ANTES');
  });

  test('al despachar tambien prioriza comestibles sobre generales', () => {
    const controlador = crearControladorParaPrioridades();
    controlador.onCamionLlega({
      id: 'C1',
      tipo: 'RECEPCION',
      muelleId: 'M1',
      tickLlegada: 1,
      ordenes: [
        {
          id: 'O1',
          camionId: 'C1',
          paqueteId: 'P_GENERAL',
          tipoPaquete: 'GENERAL',
          peso: 999,
          vencimiento: null,
        },
        {
          id: 'O2',
          camionId: 'C1',
          paqueteId: 'P_COMESTIBLE',
          tipoPaquete: 'COMESTIBLE',
          peso: 1,
          vencimiento: '2026-10-01',
        },
      ],
    });
    avanzarHastaCantidadPaquetes(controlador, 2);

    controlador.onCamionLlega({
      id: 'C2',
      tipo: 'DESPACHO',
      muelleId: 'M2',
      tickLlegada: 1,
      ordenes: [
        {
          id: 'O3',
          camionId: 'C2',
          paqueteId: 'P_GENERAL',
          tipoPaquete: 'GENERAL',
          peso: 999,
          vencimiento: null,
        },
        {
          id: 'O4',
          camionId: 'C2',
          paqueteId: 'P_COMESTIBLE',
          tipoPaquete: 'COMESTIBLE',
          peso: 1,
          vencimiento: '2026-10-01',
        },
      ],
    });

    const estado = avanzarHastaCantidadPaquetes(controlador, 1);
    const paquetesRestantes = paquetesEnEstanterias(estado);

    expect(paquetesRestantes).toHaveLength(1);
    expect(paquetesRestantes[0].id).toBe('P_GENERAL');
  });

  test('en sim2 despacha PA3 antes que PA1 porque PA3 es general mas pesado', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(
      {
        dimensiones: { width: 15, height: 8 },
        estanterias: [{ x: 6, y: 2 }, { x: 6, y: 3 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 8, y: 2 }],
        muelles: [{ x: 0, y: 4, id: 'M1' }, { x: 14, y: 3, id: 'M2' }],
        basesCarga: [{ x: 0, y: 0, id: 'B1' }, { x: 14, y: 7, id: 'B2' }, { x: 7, y: 7, id: 'B3' }],
      },
      [
        { id: 'R1', x: 2, y: 1, bateria: 20 },
        { id: 'R2', x: 12, y: 6, bateria: 30 },
        { id: 'R3', x: 4, y: 4, bateria: 10 },
      ]
    );

    let idsPrevios = new Set<string>();
    let primerPaqueteDespachado: string | null = null;

    for (let tick = 1; tick <= 180; tick++) {
      if (tick === 2) controlador.onCamionLlega(camionRecepcionSim2C1());
      if (tick === 15) controlador.onCamionLlega(camionRecepcionSim2C2());
      if (tick === 35) controlador.onCamionLlega(camionDespachoSim2C3());

      controlador.procesarPaso();
      const estado = controlador.obtenerEstado() as any;
      const idsActuales = new Set(paquetesEnEstanterias(estado).map((paquete: any) => paquete.id));

      for (const id of ['PA1', 'PA3']) {
        if (idsPrevios.has(id) && !idsActuales.has(id)) {
          primerPaqueteDespachado = id;
          break;
        }
      }

      if (primerPaqueteDespachado) break;
      idsPrevios = idsActuales;
    }

    expect(primerPaqueteDespachado).toBe('PA3');
  });

  test('en sim3 despacha PA2 antes que PA1 porque PA2 es comestible', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(
      {
        dimensiones: { width: 12, height: 7 },
        estanterias: [{ x: 5, y: 2 }, { x: 5, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 3 }, { x: 7, y: 2 }, { x: 7, y: 3 }],
        muelles: [{ x: 0, y: 3, id: 'M1' }, { x: 11, y: 3, id: 'M2' }],
        basesCarga: [{ x: 0, y: 0, id: 'B1' }, { x: 11, y: 6, id: 'B2' }],
      },
      [
        { id: 'R1', x: 2, y: 1, bateria: 30 },
        { id: 'R2', x: 9, y: 5, bateria: 30 },
      ]
    );

    let idsPrevios = new Set<string>();
    let primerPaqueteDespachado: string | null = null;

    for (let tick = 1; tick <= 120; tick++) {
      if (tick === 2) controlador.onCamionLlega(camionRecepcionSim3C1());
      if (tick === 45) controlador.onCamionLlega(camionDespachoSim3C2());

      controlador.procesarPaso();
      const estado = controlador.obtenerEstado() as any;
      const idsActuales = new Set(paquetesEnEstanterias(estado).map((paquete: any) => paquete.id));

      for (const id of ['PA1', 'PA2']) {
        if (idsPrevios.has(id) && !idsActuales.has(id)) {
          primerPaqueteDespachado = id;
          break;
        }
      }

      if (primerPaqueteDespachado) break;
      idsPrevios = idsActuales;
    }

    expect(primerPaqueteDespachado).toBe('PA2');
  });

  test('no despacha un general si el mismo camion espera un comestible mas prioritario aun no almacenado', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(
      {
        dimensiones: { width: 8, height: 5 },
        estanterias: [{ x: 3, y: 2 }, { x: 4, y: 2 }],
        muelles: [{ x: 0, y: 2, id: 'M1' }, { x: 7, y: 2, id: 'M2' }],
        basesCarga: [{ x: 7, y: 4, id: 'B1' }],
      },
      [{ id: 'R1', x: 1, y: 2, bateria: 100 }]
    );

    controlador.onCamionLlega({
      id: 'C1',
      tipo: 'RECEPCION',
      muelleId: 'M1',
      tickLlegada: 1,
      ordenes: [
        {
          id: 'O1',
          camionId: 'C1',
          paqueteId: 'PA1',
          tipoPaquete: 'GENERAL',
          peso: 20,
          vencimiento: null,
        },
      ],
    });
    avanzarHastaCantidadPaquetes(controlador, 1);

    controlador.onCamionLlega({
      id: 'C2',
      tipo: 'DESPACHO',
      muelleId: 'M2',
      tickLlegada: 1,
      ordenes: [
        {
          id: 'O2',
          camionId: 'C2',
          paqueteId: 'PA1',
          tipoPaquete: 'GENERAL',
          peso: 20,
          vencimiento: null,
        },
        {
          id: 'O3',
          camionId: 'C2',
          paqueteId: 'PA2',
          tipoPaquete: 'COMESTIBLE',
          peso: 8,
          vencimiento: '2026-10-10',
        },
      ],
    });

    avanzar(controlador, 20);
    let estado = controlador.obtenerEstado() as any;
    let paquetesAlmacenados = paquetesEnEstanterias(estado);
    expect(paquetesAlmacenados.map((paquete: any) => paquete.id)).toContain('PA1');

    controlador.onCamionLlega({
      id: 'C3',
      tipo: 'RECEPCION',
      muelleId: 'M1',
      tickLlegada: 1,
      ordenes: [
        {
          id: 'O4',
          camionId: 'C3',
          paqueteId: 'PA2',
          tipoPaquete: 'COMESTIBLE',
          peso: 8,
          vencimiento: '2026-10-10',
        },
      ],
    });

    let primerPaqueteDespachado: string | null = null;
    let idsPrevios = new Set(paquetesAlmacenados.map((paquete: any) => paquete.id));

    for (let i = 0; i < 80; i++) {
      controlador.procesarPaso();
      estado = controlador.obtenerEstado() as any;
      const idsActuales = new Set(paquetesEnEstanterias(estado).map((paquete: any) => paquete.id));

      for (const id of ['PA1', 'PA2']) {
        if (idsPrevios.has(id) && !idsActuales.has(id)) {
          primerPaqueteDespachado = id;
          break;
        }
      }

      if (primerPaqueteDespachado) break;
      idsPrevios = idsActuales;
    }

    expect(primerPaqueteDespachado).toBe('PA2');
  });

  test('un robot con carga y bateria baja llega a la base para recargar', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(
      {
        dimensiones: { width: 10, height: 10 },
        estanterias: [{ x: 4, y: 4 }],
        muelles: [{ x: 0, y: 3, id: 'M1' }],
        basesCarga: [{ x: 0, y: 0, id: 'B1' }],
      },
      [{ id: 'R1', x: 2, y: 2, bateria: 10 }]
    );
    controlador.onCamionLlega(camionRecepcion(1));

    avanzar(controlador, 9);

    const estado = controlador.obtenerEstado() as any;
    expect(estado.robots[0]).toMatchObject({
      x: 0,
      y: 0,
      estado: 'RECARGANDO',
      carga: true,
    });
  });

  test('no permite que dos robots recarguen simultaneamente en la misma base', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(
      {
        dimensiones: { width: 5, height: 5 },
        estanterias: [{ x: 4, y: 4 }],
        muelles: [{ x: 0, y: 4, id: 'M1' }],
        basesCarga: [{ x: 2, y: 2, id: 'B1' }],
      },
      [
        { id: 'R1', x: 1, y: 2, bateria: 1 },
        { id: 'R2', x: 3, y: 2, bateria: 1 },
      ]
    );

    controlador.onCamionLlega({
      id: 'C1',
      tipo: 'RECEPCION',
      muelleId: 'M1',
      tickLlegada: 1,
      ordenes: [
        {
          id: 'O1',
          camionId: 'C1',
          paqueteId: 'P1',
          tipoPaquete: 'GENERAL',
          peso: 10,
          vencimiento: null,
        },
      ],
    });

    avanzar(controlador, 4);

    const estado = controlador.obtenerEstado() as any;
    const robotsRecargandoEnBase = estado.robots.filter((robot: any) =>
      robot.x === 2 && robot.y === 2 && robot.estado === 'RECARGANDO'
    );

    expect(robotsRecargandoEnBase).toHaveLength(1);
  });

  test('despeja un robot inactivo que ocupa una base de carga', () => {
    const controlador = new ControladorAlmacen();
    controlador.inicializar(
      {
        dimensiones: { width: 4, height: 4 },
        estanterias: [],
        muelles: [],
        basesCarga: [{ x: 0, y: 0, id: 'B1' }],
      },
      [{ id: 'R1', x: 0, y: 0, bateria: 100 }]
    );

    controlador.procesarPaso();

    const estado = controlador.obtenerEstado() as any;
    expect(estado.robots[0]).not.toMatchObject({ x: 0, y: 0 });
  });

  test('permite que un robot salga de una base intercambiando lugar con otro que espera recargar', () => {
    const almacen = new Almacen(2, 2);
    const base = new Celda(0, 0, TipoCelda.BASE_CARGA, 'B1');
    const espera = new Celda(0, 1, TipoCelda.PASILLO);
    almacen.agregarCelda(base);
    almacen.agregarCelda(espera);

    const robotSaliendo = new Robot('R1', { x: 0, y: 0 }, 100);
    const robotEsperando = new Robot('R2', { x: 0, y: 1 }, 10);
    (robotEsperando as any).estado = EstadoRobot.BATERIA_BAJA;
    almacen.agregarRobot(robotSaliendo);
    almacen.agregarRobot(robotEsperando);

    (almacen as any).moverRobot(robotSaliendo, { x: 0, y: 1 });

    expect(robotSaliendo.getPosicion()).toEqual({ x: 0, y: 1 });
    expect(robotEsperando.getPosicion()).toEqual({ x: 0, y: 0 });
  });
});

function camionRecepcion(tickLlegada: number): CamionDTO {
  return {
    id: 'C1',
    tipo: 'RECEPCION',
    muelleId: 'M1',
    tickLlegada,
    ordenes: [
      {
        id: 'O1',
        camionId: 'C1',
        paqueteId: 'P1',
        tipoPaquete: 'GENERAL',
        peso: 50,
        vencimiento: null,
      },
    ],
  };
}

function camionDespacho(tickLlegada: number): CamionDTO {
  return {
    id: 'C2',
    tipo: 'DESPACHO',
    muelleId: 'M2',
    tickLlegada,
    ordenes: [
      {
        id: 'O2',
        camionId: 'C2',
        paqueteId: 'P1',
        tipoPaquete: 'GENERAL',
        peso: 50,
        vencimiento: null,
      },
    ],
  };
}

function camionRecepcionSim1(): CamionDTO {
  return {
    id: 'C1',
    tipo: 'RECEPCION',
    muelleId: 'M1',
    tickLlegada: 2,
    ordenes: [
      {
        id: 'O1',
        camionId: 'C1',
        paqueteId: 'P1',
        tipoPaquete: 'GENERAL',
        peso: 50,
        vencimiento: null,
      },
      {
        id: 'O2',
        camionId: 'C1',
        paqueteId: 'P2',
        tipoPaquete: 'COMESTIBLE',
        peso: 10,
        vencimiento: '2026-12-31',
      },
    ],
  };
}

function camionDespachoSim1(): CamionDTO {
  return {
    id: 'C2',
    tipo: 'DESPACHO',
    muelleId: 'M2',
    tickLlegada: 25,
    ordenes: [
      {
        id: 'O3',
        camionId: 'C2',
        paqueteId: 'P2',
        tipoPaquete: 'COMESTIBLE',
        peso: 10,
        vencimiento: null,
      },
      {
        id: 'O4',
        camionId: 'C2',
        paqueteId: 'P1',
        tipoPaquete: 'GENERAL',
        peso: 50,
        vencimiento: null,
      },
    ],
  };
}

function camionRecepcionSim2C1(): CamionDTO {
  return {
    id: 'C1',
    tipo: 'RECEPCION',
    muelleId: 'M1',
    tickLlegada: 2,
    ordenes: [
      {
        id: 'O1',
        camionId: 'C1',
        paqueteId: 'PA1',
        tipoPaquete: 'GENERAL',
        peso: 30,
        vencimiento: null,
      },
      {
        id: 'O2',
        camionId: 'C1',
        paqueteId: 'PA2',
        tipoPaquete: 'COMESTIBLE',
        peso: 5,
        vencimiento: '2026-11-01',
      },
    ],
  };
}

function camionRecepcionSim2C2(): CamionDTO {
  return {
    id: 'C2',
    tipo: 'RECEPCION',
    muelleId: 'M1',
    tickLlegada: 15,
    ordenes: [
      {
        id: 'O3',
        camionId: 'C2',
        paqueteId: 'PA3',
        tipoPaquete: 'GENERAL',
        peso: 80,
        vencimiento: null,
      },
      {
        id: 'O4',
        camionId: 'C2',
        paqueteId: 'PA4',
        tipoPaquete: 'COMESTIBLE',
        peso: 12,
        vencimiento: '2026-08-15',
      },
    ],
  };
}

function camionDespachoSim2C3(): CamionDTO {
  return {
    id: 'C3',
    tipo: 'DESPACHO',
    muelleId: 'M2',
    tickLlegada: 35,
    ordenes: [
      {
        id: 'O5',
        camionId: 'C3',
        paqueteId: 'PA1',
        tipoPaquete: 'GENERAL',
        peso: 30,
        vencimiento: null,
      },
      {
        id: 'O6',
        camionId: 'C3',
        paqueteId: 'PA3',
        tipoPaquete: 'GENERAL',
        peso: 80,
        vencimiento: null,
      },
    ],
  };
}

function camionRecepcionSim3C1(): CamionDTO {
  return {
    id: 'C1',
    tipo: 'RECEPCION',
    muelleId: 'M1',
    tickLlegada: 2,
    ordenes: [
      {
        id: 'O1',
        camionId: 'C1',
        paqueteId: 'PA1',
        tipoPaquete: 'GENERAL',
        peso: 20,
        vencimiento: null,
      },
      {
        id: 'O2',
        camionId: 'C1',
        paqueteId: 'PA2',
        tipoPaquete: 'COMESTIBLE',
        peso: 8,
        vencimiento: '2026-10-10',
      },
    ],
  };
}

function camionDespachoSim3C2(): CamionDTO {
  return {
    id: 'C2',
    tipo: 'DESPACHO',
    muelleId: 'M2',
    tickLlegada: 45,
    ordenes: [
      {
        id: 'O3',
        camionId: 'C2',
        paqueteId: 'PA1',
        tipoPaquete: 'GENERAL',
        peso: 20,
        vencimiento: null,
      },
      {
        id: 'O4',
        camionId: 'C2',
        paqueteId: 'PA2',
        tipoPaquete: 'COMESTIBLE',
        peso: 8,
        vencimiento: '2026-10-10',
      },
    ],
  };
}
