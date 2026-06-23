import { EstadoRobot } from '../enums/EstadoRobot';
import { TipoCamion } from '../enums/TipoCamion';
import { TipoCelda } from '../enums/TipoCelda';
import { Celda } from './Celda';
import { Camion } from './Camion';
import { Posicion, clavePosicion, distanciaManhattan, mismaPosicion } from './Posicion';
import { Robot, AsignacionRobot, ServiciosRobot } from './Robot';
import { AsignadorOrdenes } from '../services/AsignadorOrdenes';
import { EstadoAlmacenMapper, EstadoAlmacenSnapshot } from '../services/EstadoAlmacenMapper';
import { GestorCamiones } from '../services/GestorCamiones';

export class Almacen {
  private readonly celdas = new Map<string, Celda>();
  private readonly robots: Robot[] = [];
  private readonly gestorCamiones = new GestorCamiones();
  private readonly asignadorOrdenes = new AsignadorOrdenes();
  private muellesOcupadosAlInicioDelTick = new Set<string>();
  private tickActual = 0;

  constructor(
    private readonly width: number,
    private readonly height: number
  ) {}

  public agregarCelda(celda: Celda): void {
    this.guardarCelda(celda);
  }

  public agregarRobot(robot: Robot): void {
    const celda = this.obtenerCelda(robot.getPosicion());
    celda.ocuparConRobot(robot.id);
    this.robots.push(robot);
  }

  public registrarCamion(camion: Camion): void {
    this.gestorCamiones.registrarCamion(camion, {
      buscarMuellePorId: (id) => this.buscarMuellePorId(id),
    });
  }

  public procesarPaso(): void {
    this.tickActual++;
    this.registrarMuellesOcupadosAlInicioDelTick();
    this.liberarOrdenesDeCamionesPrevios();
    this.despejarRobotsInactivos();
    this.asignarOrdenesARobotsLibres();
    this.procesarRobots();
    this.retirarCamionesCompletados();
    this.acoplarCamionesEnEspera();
  }

  public obtenerEstado(): EstadoAlmacenSnapshot {
    return EstadoAlmacenMapper.desdeContexto({
      width: this.width,
      height: this.height,
      robots: this.robots,
      camiones: this.gestorCamiones.camionesRegistrados(),
      estanterias: this.estanterias(),
      basesCarga: this.basesCarga(),
      buscarMuellePorId: (id) => this.buscarMuellePorId(id),
    });
  }

  private guardarCelda(celda: Celda): void {
    this.celdas.set(clavePosicion(celda.posicion()), celda);
  }

  private liberarOrdenesDeCamionesPrevios(): void {
    this.gestorCamiones.liberarOrdenesDeCamionesPrevios(this.tickActual);
  }

  private despejarRobotsInactivos(): void {
    const servicios = this.crearServiciosRobot();
    for (const robot of this.robots) {
      if (!robot.estaInactivo()) continue;

      const celda = this.obtenerCelda(robot.getPosicion());
      if (celda.tipo === TipoCelda.PASILLO) continue;

      const pasillo = this.pasilloMasCercanoLibre(robot.getPosicion());
      if (pasillo) {
        this.moverRobotUnPaso(robot, pasillo.posicion(), servicios);
      }
    }
  }

  private asignarOrdenesARobotsLibres(): void {
    for (const robot of this.robots) {
      if (!robot.estaInactivo()) continue;

      const celdaRobot = this.obtenerCelda(robot.getPosicion());
      if (celdaRobot.tipo === TipoCelda.MUELLE || celdaRobot.tipo === TipoCelda.ESTANTERIA) continue;

      const asignacion = this.proximaAsignacionDisponible();
      if (!asignacion) return;

      asignacion.destino.reservarPara(robot.id);
      if (asignacion.orden.tipoCamion === TipoCamion.DESPACHO) {
        asignacion.origen.reservarPara(robot.id);
      }
      console.log(
        `[DEBUG] asignacion robot=${robot.id} orden=${asignacion.orden.id} paquete=${asignacion.orden.paquete.id} ` +
        `tipoCamion=${asignacion.orden.tipoCamion} origen=(${asignacion.origen.x},${asignacion.origen.y}) ` +
        `destino=(${asignacion.destino.x},${asignacion.destino.y})`
      );
      robot.asignarOrden(asignacion);
    }
  }

  private proximaAsignacionDisponible(): AsignacionRobot | null {
    return this.asignadorOrdenes.proximaAsignacionDisponible({
      camiones: this.gestorCamiones.camionesRegistrados(),
      buscarMuellePorId: (id) => this.buscarMuellePorId(id),
      estanterias: () => this.estanterias(),
    });
  }

  private procesarRobots(): void {
    const servicios = this.crearServiciosRobot();
    for (const robot of this.robots) {
      const resultado = robot.procesarPaso(servicios);
      const ordenCompletada = resultado.ordenCompletada;
      if (ordenCompletada) {
        this.liberarReservasDeRobot(robot.id);
      }
    }
  }

  private retirarCamionesCompletados(): void {
    this.gestorCamiones.retirarCamionesCompletados({
      tickActual: this.tickActual,
      buscarMuellePorId: (id) => this.buscarMuellePorId(id),
      hayRobotEnCelda: (celda) => this.hayRobotEnCelda(celda),
      muelleOcupadoAlInicioDelTick: (celda) => this.muellesOcupadosAlInicioDelTick.has(clavePosicion(celda.posicion())),
    });
  }

  private acoplarCamionesEnEspera(): void {
    this.gestorCamiones.acoplarCamionesEnEspera({
      buscarMuellePorId: (id) => this.buscarMuellePorId(id),
    });
  }

  private crearServiciosRobot(): ServiciosRobot {
    return {
      estaDentroDelMapa: (posicion) => this.estaDentroDelMapa(posicion),
      puedeOcupar: (posicion, robotId) => this.puedeOcupar(posicion, robotId),
      moverRobot: (robot, siguiente) => this.moverRobot(robot, siguiente),
      baseCargaMasCercana: (posicion, robotId) => this.baseCargaMasCercana(posicion, robotId),
    };
  }

  private moverRobotUnPaso(robot: Robot, destino: Posicion, servicios: ServiciosRobot): void {
    const actual = robot.getPosicion();
    const candidatos = [
      { x: actual.x + Math.sign(destino.x - actual.x), y: actual.y },
      { x: actual.x, y: actual.y + Math.sign(destino.y - actual.y) },
    ].filter((posicion) => !mismaPosicion(posicion, actual));

    const siguiente = candidatos.find((posicion) => servicios.estaDentroDelMapa(posicion) && servicios.puedeOcupar(posicion, robot.id));
    if (siguiente) {
      this.moverRobot(robot, siguiente);
    }
  }

  private moverRobot(robot: Robot, siguiente: Posicion): boolean {
    const origen = this.obtenerCelda(robot.getPosicion());
    const destino = this.obtenerCelda(siguiente);
    if (destino.estaOcupadaPorRobot() && destino.getRobotId() !== robot.id) {
      return this.intentarIntercambioConRobotEsperandoCarga(robot, origen, destino);
    }

    origen.liberarRobot();
    destino.ocuparConRobot(robot.id);
    robot.forzarPosicion(siguiente);
    return true;
  }

  private intentarIntercambioConRobotEsperandoCarga(robot: Robot, origen: Celda, destino: Celda): boolean {
    if (origen.tipo !== TipoCelda.BASE_CARGA) return false;

    const robotBloqueanteId = destino.getRobotId();
    if (!robotBloqueanteId) return false;

    const robotBloqueante = this.buscarRobotPorId(robotBloqueanteId);
    if (!robotBloqueante || robotBloqueante.getEstado() !== EstadoRobot.BATERIA_BAJA) return false;

    destino.ocuparConRobot(robot.id);
    origen.ocuparConRobot(robotBloqueante.id);
    robot.forzarPosicion(destino.posicion());
    robotBloqueante.forzarPosicion(origen.posicion());
    return true;
  }

  private puedeOcupar(posicion: Posicion, robotId: string): boolean {
    const celda = this.obtenerCelda(posicion);
    return (!celda.estaOcupadaPorRobot() || celda.getRobotId() === robotId)
      && !celda.estaReservadaPorOtro(robotId);
  }

  private estaDentroDelMapa(posicion: Posicion): boolean {
    return posicion.x >= 0 && posicion.x < this.width && posicion.y >= 0 && posicion.y < this.height;
  }

  private obtenerCelda(posicion: Posicion): Celda {
    const celda = this.celdas.get(clavePosicion(posicion));
    if (!celda) {
      throw new Error(`No existe la celda (${posicion.x}, ${posicion.y})`);
    }
    return celda;
  }

  private buscarMuellePorId(id: string): Celda | null {
    return [...this.celdas.values()].find((celda) => celda.tipo === TipoCelda.MUELLE && celda.id === id) ?? null;
  }

  private estanterias(): Celda[] {
    return [...this.celdas.values()].filter((celda) => celda.tipo === TipoCelda.ESTANTERIA);
  }

  private basesCarga(): Celda[] {
    return [...this.celdas.values()].filter((celda) => celda.tipo === TipoCelda.BASE_CARGA);
  }

  private baseCargaMasCercana(posicion: Posicion, robotId: string): Celda | null {
    return this.basesCarga()
      .sort((a, b) => distanciaManhattan(posicion, a.posicion()) - distanciaManhattan(posicion, b.posicion()))[0] ?? null;
  }

  private pasilloMasCercanoLibre(posicion: Posicion): Celda | null {
    return [...this.celdas.values()]
      .filter((celda) => celda.tipo === TipoCelda.PASILLO && !celda.estaOcupadaPorRobot())
      .sort((a, b) => distanciaManhattan(posicion, a.posicion()) - distanciaManhattan(posicion, b.posicion()))[0] ?? null;
  }

  private registrarMuellesOcupadosAlInicioDelTick(): void {
    this.muellesOcupadosAlInicioDelTick = new Set(
      [...this.celdas.values()]
        .filter((celda) => celda.tipo === TipoCelda.MUELLE && this.hayRobotEnCelda(celda))
        .map((celda) => clavePosicion(celda.posicion()))
    );
  }

  private hayRobotEnCelda(celda: Celda): boolean {
    return celda.estaOcupadaPorRobot()
      || this.robots.some((robot) => mismaPosicion(robot.getPosicion(), celda.posicion()));
  }

  private buscarRobotPorId(robotId: string): Robot | null {
    return this.robots.find((robot) => robot.id === robotId) ?? null;
  }

  private liberarReservasDeRobot(robotId: string): void {
    for (const celda of this.celdas.values()) {
      if (celda.getReservaRobotId() === robotId) {
        celda.liberarReserva();
      }
    }
  }

}
