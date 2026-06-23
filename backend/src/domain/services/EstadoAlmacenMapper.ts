import { Camion } from '../entities/Camion';
import { Celda } from '../entities/Celda';
import { Robot } from '../entities/Robot';

export interface EstadoAlmacenSnapshot {
  dimensiones: { width: number; height: number };
  robots: Array<{ x: number; y: number; estado: string; carga: boolean }>;
  camiones: Array<{ x: number; y: number; tipo: 'RECEPCION' | 'DESPACHO' }>;
  estanterias: Array<{ x: number; y: number; paquetes: unknown[] }>;
  basesCarga: Array<{ x: number; y: number }>;
}

export interface ContextoEstadoAlmacen {
  width: number;
  height: number;
  robots: Robot[];
  camiones: Camion[];
  estanterias: Celda[];
  basesCarga: Celda[];
  buscarMuellePorId(id: string): Celda | null;
}

export class EstadoAlmacenMapper {
  public static desdeContexto(contexto: ContextoEstadoAlmacen): EstadoAlmacenSnapshot {
    return {
      dimensiones: { width: contexto.width, height: contexto.height },
      robots: contexto.robots.map((robot) => ({
        ...robot.getPosicion(),
        estado: robot.getEstado(),
        carga: robot.tieneCarga(),
      })),
      camiones: contexto.camiones
        .filter((camion) => !camion.estaRetirado())
        .map((camion) => {
          const muelle = contexto.buscarMuellePorId(camion.muelleId);
          return {
            x: muelle?.x ?? 0,
            y: muelle?.y ?? 0,
            tipo: camion.tipo,
          };
        }),
      estanterias: contexto.estanterias.map((celda) => ({
        x: celda.x,
        y: celda.y,
        paquetes: celda.getPaquete() ? [celda.getPaquete()] : [],
      })),
      basesCarga: contexto.basesCarga.map((celda) => ({ x: celda.x, y: celda.y })),
    };
  }
}
