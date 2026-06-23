import { Celda } from '../src/domain/entities/Celda';
import { Orden } from '../src/domain/entities/Orden';
import { Paquete } from '../src/domain/entities/Paquete';
import { Robot, ServiciosRobot } from '../src/domain/entities/Robot';
import { EstadoRobot } from '../src/domain/enums/EstadoRobot';
import { TipoCamion } from '../src/domain/enums/TipoCamion';
import { TipoCelda } from '../src/domain/enums/TipoCelda';
import { TipoPaquete } from '../src/domain/enums/TipoPaquete';

describe('Robot - gestion de energia', () => {
  test('transiciona a bateria baja cuando su bateria es apenas suficiente para llegar a la base', () => {
    const robot = new Robot('R1', { x: 0, y: 2 }, 2);
    robot.asignarOrden(crearAsignacion({ x: 0, y: 2 }, { x: 4, y: 2 }));

    robot.procesarPaso(crearServicios(robot, new Celda(0, 0, TipoCelda.BASE_CARGA, 'B1')));

    expect(robot.getEstado()).toBe(EstadoRobot.BATERIA_BAJA);
    expect(robot.getPosicion()).toEqual({ x: 0, y: 1 });
    expect(robot.getBateria()).toBe(1);
  });

  test('queda inmovilizado si la bateria llega a cero mientras opera lejos de la base', () => {
    const robot = new Robot('R1', { x: 0, y: 0 }, 1);
    robot.asignarOrden(crearAsignacion({ x: 2, y: 0 }, { x: 4, y: 0 }));

    robot.procesarPaso(crearServicios(robot, null));

    expect(robot.getEstado()).toBe(EstadoRobot.INMOVILIZADO);
    expect(robot.getPosicion()).toEqual({ x: 1, y: 0 });
    expect(robot.getBateria()).toBe(0);
  });

  test('recarga antes de tomar un paquete si con carga no llega a la base', () => {
    const robot = new Robot('R1', { x: 0, y: 8 }, 10);
    robot.asignarOrden(crearAsignacion({ x: 0, y: 8 }, { x: 4, y: 8 }));

    robot.procesarPaso(crearServicios(robot, new Celda(0, 0, TipoCelda.BASE_CARGA, 'B1')));

    expect(robot.getEstado()).toBe(EstadoRobot.BATERIA_BAJA);
    expect(robot.getPosicion()).toEqual({ x: 0, y: 7 });
    expect(robot.tieneCarga()).toBe(false);
    expect(robot.getBateria()).toBe(9);
  });

  test('no gasta bateria intentando entrar a una base ocupada', () => {
    const robot = new Robot('R1', { x: 0, y: 1 }, 1);
    const base = new Celda(0, 0, TipoCelda.BASE_CARGA, 'B1');
    base.ocuparConRobot('R2');
    robot.asignarOrden(crearAsignacion({ x: 0, y: 1 }, { x: 4, y: 1 }));

    const servicios: ServiciosRobot = {
      estaDentroDelMapa: (posicion) => posicion.x >= 0 && posicion.x < 10 && posicion.y >= 0 && posicion.y < 10,
      puedeOcupar: (posicion) => !(posicion.x === base.x && posicion.y === base.y),
      moverRobot: (_robot, siguiente) => {
        if (siguiente.x !== base.x || siguiente.y !== base.y) {
          robot.forzarPosicion(siguiente);
          return true;
        }
        return false;
      },
      baseCargaMasCercana: () => base,
    };

    for (let i = 0; i < 4; i++) {
      robot.procesarPaso(servicios);
    }

    expect(robot.getEstado()).toBe(EstadoRobot.BATERIA_BAJA);
    expect(robot.getPosicion()).toEqual({ x: 0, y: 1 });
    expect(robot.getBateria()).toBe(1);
  });
});

function crearAsignacion(origen: { x: number; y: number }, destino: { x: number; y: number }) {
  const paquete = new Paquete('P1', TipoPaquete.GENERAL, 10);
  const orden = new Orden('O1', 'C1', paquete, TipoCamion.RECEPCION);
  return {
    orden,
    origen: new Celda(origen.x, origen.y, TipoCelda.MUELLE, 'M1'),
    destino: new Celda(destino.x, destino.y, TipoCelda.ESTANTERIA),
  };
}

function crearServicios(robot: Robot, base: Celda | null): ServiciosRobot {
  return {
    estaDentroDelMapa: (posicion) => posicion.x >= 0 && posicion.x < 10 && posicion.y >= 0 && posicion.y < 10,
    puedeOcupar: () => true,
    moverRobot: (_robot, siguiente) => {
      robot.forzarPosicion(siguiente);
      return true;
    },
    baseCargaMasCercana: () => base,
  };
}
