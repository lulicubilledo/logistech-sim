import { EstadoRobot } from '../enums/EstadoRobot';
import { EstrategiaNavegacion } from '../enums/EstrategiaNavegacion';
import { TipoCamion } from '../enums/TipoCamion';
import { Celda } from './Celda';
import { Orden } from './Orden';
import { Paquete } from './Paquete';
import { Posicion, distanciaManhattan, mismaPosicion } from './Posicion';
import { ContextoNavegacion } from '../navigation/EstrategiaDeNavegacion';
import { MovimientoEnL } from '../navigation/MovimientoEnL';
import { AEstrella } from '../navigation/AEstrella';

type EtapaTarea = 'IR_A_ORIGEN' | 'IR_A_DESTINO';

export interface AsignacionRobot {
  orden: Orden;
  origen: Celda;
  destino: Celda;
}

export interface ResultadoRobot {
  ordenCompletada?: Orden;
  paqueteDepositado?: Paquete;
  paqueteRetirado?: Paquete;
}

export interface ServiciosRobot extends ContextoNavegacion {
  moverRobot(robot: Robot, siguiente: Posicion): boolean;
  baseCargaMasCercana(posicion: Posicion, robotId: string): Celda | null;
}

export class Robot {
  private estado: EstadoRobot = EstadoRobot.INACTIVO;
  private estrategia: EstrategiaNavegacion = EstrategiaNavegacion.MOVIMIENTO_EN_L;
  private ticksBloqueado: number = 0;
  private orden: Orden | null = null;
  private origen: Celda | null = null;
  private destino: Celda | null = null;
  private etapa: EtapaTarea = 'IR_A_ORIGEN';
  private carga: Paquete | null = null;
  private estadoPrevioRecarga: EstadoRobot = EstadoRobot.INACTIVO;

  constructor(
    public readonly id: string,
    private posicionActual: Posicion,
    private bateria: number
  ) {}

  public getPosicion(): Posicion {
    return { ...this.posicionActual };
  }

  public getBateria(): number {
    return this.bateria;
  }

  public getEstado(): EstadoRobot {
    return this.estado;
  }

  public tieneCarga(): boolean {
    return this.carga !== null;
  }

  public estaInactivo(): boolean {
    return this.estado === EstadoRobot.INACTIVO && this.orden === null;
  }

  public getOrden(): Orden | null {
    return this.orden;
  }

  public asignarOrden(asignacion: AsignacionRobot): void {
    this.orden = asignacion.orden;
    this.origen = asignacion.origen;
    this.destino = asignacion.destino;
    this.etapa = 'IR_A_ORIGEN';
    this.estado = EstadoRobot.OPERANDO;
    this.estrategia = EstrategiaNavegacion.MOVIMIENTO_EN_L;
    this.ticksBloqueado = 0;
    asignacion.orden.marcarAsignada();
  }

  public estaSobre(celda: Celda): boolean {
    return mismaPosicion(this.posicionActual, celda.posicion());
  }

  public procesarPaso(servicios: ServiciosRobot): ResultadoRobot {
    if (this.estado === EstadoRobot.INMOVILIZADO) return {};

    if (this.bateria <= 0) {
      const base = servicios.baseCargaMasCercana(this.posicionActual, this.id);
      if (this.estado === EstadoRobot.BATERIA_BAJA && base && this.estaSobre(base)) {
        this.estado = EstadoRobot.RECARGANDO;
        this.recargar();
        return {};
      }
      this.estado = EstadoRobot.INMOVILIZADO;
      return {};
    }

    if (this.estado === EstadoRobot.RECARGANDO) {
      this.recargar();
      return {};
    }

    if (this.debeIrARecargar(servicios)) {
      this.estadoPrevioRecarga = this.estado;
      this.estado = EstadoRobot.BATERIA_BAJA;
    }

    if (this.estado === EstadoRobot.BATERIA_BAJA) {
      return this.irARecargar(servicios);
    }

    if (!this.orden || !this.origen || !this.destino) return {};

    const objetivo = this.etapa === 'IR_A_ORIGEN' ? this.origen : this.destino;
    if (!this.estaSobre(objetivo)) {
      this.moverHacia(objetivo.posicion(), servicios);
      return {};
    }

    if (this.etapa === 'IR_A_ORIGEN') {
      if (this.debeRecargarAntesDeTomarCarga(servicios)) {
        this.estadoPrevioRecarga = this.estado;
        this.estado = EstadoRobot.BATERIA_BAJA;
        return this.irARecargar(servicios);
      }
      return this.tomarPaquete();
    }

    return this.entregarPaquete();
  }

  public forzarPosicion(posicion: Posicion): void {
    this.posicionActual = { ...posicion };
  }

  public liberarTarea(): void {
    this.orden?.liberarAsignacion();
    this.orden = null;
    this.origen = null;
    this.destino = null;
    this.carga = null;
    this.estado = EstadoRobot.INACTIVO;
    this.etapa = 'IR_A_ORIGEN';
  }

  private tomarPaquete(): ResultadoRobot {
    if (!this.orden || !this.origen) return {};

    if (this.orden.tipoCamion === TipoCamion.RECEPCION) {
      this.carga = this.orden.paquete;
      this.etapa = 'IR_A_DESTINO';
      console.log(
        `[DEBUG] toma robot=${this.id} orden=${this.orden.id} paquete=${this.carga.id} ` +
        `origen=(${this.origen.x},${this.origen.y}) destino=(${this.destino?.x},${this.destino?.y})`
      );
      return {};
    }

    this.carga = this.origen.retirarPaquete();
    this.etapa = 'IR_A_DESTINO';
    console.log(
      `[DEBUG] toma robot=${this.id} orden=${this.orden.id} paquete=${this.carga.id} ` +
      `origen=(${this.origen.x},${this.origen.y}) destino=(${this.destino?.x},${this.destino?.y})`
    );
    return { paqueteRetirado: this.carga };
  }

  private entregarPaquete(): ResultadoRobot {
    if (!this.orden || !this.destino || !this.carga) return {};

    const paquete = this.carga;
    if (this.orden.tipoCamion === TipoCamion.RECEPCION) {
      this.destino.almacenarPaquete(paquete);
    }

    console.log(
      `[DEBUG] deja robot=${this.id} orden=${this.orden.id} paquete=${paquete.id} ` +
      `destino=(${this.destino.x},${this.destino.y})`
    );
    this.carga = null;
    this.orden.completar();
    const ordenCompletada = this.orden;
    this.orden = null;
    this.origen = null;
    this.destino = null;
    this.estado = EstadoRobot.INACTIVO;
    this.etapa = 'IR_A_ORIGEN';
    return { ordenCompletada, paqueteDepositado: paquete };
  }

  private debeIrARecargar(servicios: ServiciosRobot): boolean {
    if (this.estado === EstadoRobot.INACTIVO && !this.orden) return false;
    const base = servicios.baseCargaMasCercana(this.posicionActual, this.id);
    if (!base) return false;
    if (this.estaSobre(base)) return false;
    const costoPorPaso = this.costoPorMovimiento();
    const costoHastaBase = distanciaManhattan(this.posicionActual, base.posicion()) * costoPorPaso;
    return this.bateria <= costoHastaBase || this.bateria - costoPorPaso <= costoHastaBase;
  }

  private debeRecargarAntesDeTomarCarga(servicios: ServiciosRobot): boolean {
    if (this.carga || !this.orden) return false;
    const base = servicios.baseCargaMasCercana(this.posicionActual, this.id);
    if (!base || this.estaSobre(base)) return false;

    const costoHastaBaseConCarga = distanciaManhattan(this.posicionActual, base.posicion()) * 2;
    return this.bateria < costoHastaBaseConCarga;
  }

  private irARecargar(servicios: ServiciosRobot): ResultadoRobot {
    const base = servicios.baseCargaMasCercana(this.posicionActual, this.id);
    if (!base) return {};

    if (this.estaSobre(base)) {
      this.estado = EstadoRobot.RECARGANDO;
      this.recargar();
      return {};
    }

    this.moverHacia(base.posicion(), servicios, true);
    return {};
  }

  private recargar(): void {
    this.bateria = Math.min(100, this.bateria + 10);
    if (this.bateria >= 100) {
      this.estado = this.orden ? EstadoRobot.OPERANDO : this.estadoPrevioRecarga;
      if (this.estado === EstadoRobot.BATERIA_BAJA || this.estado === EstadoRobot.RECARGANDO) {
        this.estado = this.orden ? EstadoRobot.OPERANDO : EstadoRobot.INACTIVO;
      }
    }
  }

  private moverHacia(destino: Posicion, servicios: ServiciosRobot, permitirLlegarSinBateria = false): void {
    const estrategia = this.estrategia === EstrategiaNavegacion.A_ESTRELLA
      ? new AEstrella()
      : new MovimientoEnL();
    const siguiente = estrategia.siguientePaso(this.posicionActual, destino, this.id, servicios)
      ?? this.pasoDirectoHacia(destino, servicios);

    if (!siguiente) {
      this.ticksBloqueado++;
      if (this.ticksBloqueado >= 3) {
        this.estrategia = EstrategiaNavegacion.A_ESTRELLA;
      }
      return;
    }

    const costo = this.costoPorMovimiento();
    const seMovio = servicios.moverRobot(this, siguiente);
    if (!seMovio) {
      this.ticksBloqueado++;
      if (this.ticksBloqueado >= 3) {
        this.estrategia = EstrategiaNavegacion.A_ESTRELLA;
      }
      return;
    }

    this.bateria = Math.max(0, this.bateria - costo);
    this.ticksBloqueado = 0;
    if (this.bateria <= 0 && !(permitirLlegarSinBateria && mismaPosicion(siguiente, destino))) {
      this.estado = EstadoRobot.INMOVILIZADO;
    }
  }

  private pasoDirectoHacia(destino: Posicion, servicios: ServiciosRobot): Posicion | null {
    const candidatos: Posicion[] = [];

    if (this.posicionActual.x !== destino.x) {
      candidatos.push({ x: this.posicionActual.x + Math.sign(destino.x - this.posicionActual.x), y: this.posicionActual.y });
    }

    if (this.posicionActual.y !== destino.y) {
      candidatos.push({ x: this.posicionActual.x, y: this.posicionActual.y + Math.sign(destino.y - this.posicionActual.y) });
    }

    return candidatos.find((posicion) => servicios.estaDentroDelMapa(posicion)) ?? null;
  }

  private costoPorMovimiento(): number {
    return this.carga ? 2 : 1;
  }
}
