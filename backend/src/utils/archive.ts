import { Model, ModelStatic, Op } from 'sequelize';

/**
 * Shared archive/restore/permanent-delete helpers for paranoid models.
 *
 * Every admin-managed record table (products, services, BTU factors, service
 * requests, schedules, reports) gained a paranoid `deletedAt` for the Archive
 * feature. Rather than repeat the same soft-delete / restore / force-delete /
 * list-archived logic in each service, these helpers centralize it so behavior
 * (and the 404 / 409 semantics) stays identical everywhere.
 *
 * `restore` and `permanentlyDelete` refuse to act on a row that isn't actually
 * archived — the same deliberate speed bump used by the account archive.
 */

interface HttpError extends Error {
  statusCode: number;
}

function httpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

/** Soft-deletes (archives) a live row. 404 if it doesn't exist. */
export async function archiveRecord<M extends Model>(
  model: ModelStatic<M>,
  id: number,
  label: string
): Promise<void> {
  const row = await model.findByPk(id);
  if (!row) throw httpError(404, `${label} not found`);
  await row.destroy(); // paranoid → sets deleted_at
}

/** Restores an archived row. 404 if missing, 409 if it isn't archived. */
export async function restoreRecord<M extends Model & { deletedAt?: Date | null }>(
  model: ModelStatic<M>,
  id: number,
  label: string
): Promise<void> {
  const row = await model.findByPk(id, { paranoid: false });
  if (!row) throw httpError(404, `${label} not found`);
  if (!row.getDataValue('deletedAt' as keyof M)) {
    throw httpError(409, `That ${label.toLowerCase()} is not archived`);
  }
  await row.restore();
}

/** Permanently (force) deletes an archived row. 404 if missing, 409 if live. */
export async function permanentlyDeleteRecord<M extends Model>(
  model: ModelStatic<M>,
  id: number,
  label: string
): Promise<void> {
  const row = await model.findByPk(id, { paranoid: false });
  if (!row) throw httpError(404, `${label} not found`);
  if (!row.getDataValue('deletedAt' as keyof M)) {
    throw httpError(409, `Archive this ${label.toLowerCase()} before deleting it permanently`);
  }
  await row.destroy({ force: true });
}

/** Lists only archived rows (deletedAt set), most recently archived first. */
export async function listArchivedRecords<M extends Model>(
  model: ModelStatic<M>,
  options: { order?: string } = {}
): Promise<M[]> {
  return model.findAll({
    paranoid: false,
    where: { deletedAt: { [Op.ne]: null } } as never,
    order: [[options.order ?? 'deletedAt', 'DESC']],
  });
}
