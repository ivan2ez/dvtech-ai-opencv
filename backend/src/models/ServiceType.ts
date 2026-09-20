import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
} from 'sequelize-typescript';

// `paranoid` makes archive a soft delete (row kept with `deleted_at`, hidden by
// default) so a deleted service can be restored or permanently removed. This is
// separate from the Available/Unavailable toggle (`isActive`), which only hides
// a live service from the customer's booking dropdown.
@Table({
  tableName: 'service_types',
  timestamps: true,
  underscored: true,
  paranoid: true,
})
export class ServiceType extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
  declare description: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare price: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  /**
   * Admin-controlled display priority for the public services list. Higher
   * values appear first (a proxy for "most-availed"), so admins can surface the
   * services customers request most. Ties fall back to name.
   */
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'sort_weight',
  })
  declare sortWeight: number;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  /** Set when the admin archives the service; cleared on restore. */
  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;
}
