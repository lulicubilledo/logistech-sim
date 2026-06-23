import { MapaConfigDTO, RobotConfigDTO } from '../../infrastructure/dtos';
import { Almacen } from '../../domain/entities/Almacen';
import { Celda } from '../../domain/entities/Celda';
import { Robot } from '../../domain/entities/Robot';
import { TipoCelda } from '../../domain/enums/TipoCelda';

export class AlmacenMapper {
  public static desdeDTO(mapaConfig: MapaConfigDTO, robotsConfig: RobotConfigDTO[]): Almacen {
    const almacen = new Almacen(mapaConfig.dimensiones.width, mapaConfig.dimensiones.height);

    for (let y = 0; y < mapaConfig.dimensiones.height; y++) {
      for (let x = 0; x < mapaConfig.dimensiones.width; x++) {
        almacen.agregarCelda(new Celda(x, y, TipoCelda.PASILLO));
      }
    }

    for (const estanteria of mapaConfig.estanterias) {
      almacen.agregarCelda(new Celda(estanteria.x, estanteria.y, TipoCelda.ESTANTERIA));
    }

    for (const muelle of mapaConfig.muelles) {
      almacen.agregarCelda(new Celda(muelle.x, muelle.y, TipoCelda.MUELLE, muelle.id));
    }

    for (const base of mapaConfig.basesCarga) {
      almacen.agregarCelda(new Celda(base.x, base.y, TipoCelda.BASE_CARGA, base.id));
    }

    for (const robotConfig of robotsConfig) {
      almacen.agregarRobot(new Robot(
        robotConfig.id,
        { x: robotConfig.x, y: robotConfig.y },
        robotConfig.bateria
      ));
    }

    return almacen;
  }
}
// no representan nada del dominio pero tienen una responsabilidad clara: traducir DTOs a objetos de dominio.