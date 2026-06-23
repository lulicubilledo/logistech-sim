import { CamionDTO } from '../../infrastructure/dtos';
import { Camion } from '../../domain/entities/Camion';
import { Orden } from '../../domain/entities/Orden';
import { Paquete } from '../../domain/entities/Paquete';
import { TipoCamion } from '../../domain/enums/TipoCamion';
import { TipoPaquete } from '../../domain/enums/TipoPaquete';

export class CamionMapper {
  public static desdeDTO(camionDTO: CamionDTO): Camion {
    const tipoCamion = camionDTO.tipo === 'RECEPCION'
      ? TipoCamion.RECEPCION
      : TipoCamion.DESPACHO;

    const ordenes = camionDTO.ordenes.map((ordenDTO) => {
      const tipoPaquete = ordenDTO.tipoPaquete === 'COMESTIBLE'
        ? TipoPaquete.COMESTIBLE
        : TipoPaquete.GENERAL;
      const vencimiento = ordenDTO.vencimiento
        ? new Date(`${ordenDTO.vencimiento}T00:00:00`)
        : null;
      const paquete = new Paquete(ordenDTO.paqueteId, tipoPaquete, ordenDTO.peso, vencimiento);
      return new Orden(ordenDTO.id, ordenDTO.camionId, paquete, tipoCamion);
    });

    return new Camion(camionDTO.id, tipoCamion, camionDTO.muelleId, camionDTO.tickLlegada, ordenes);
  }
}
