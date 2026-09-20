import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  DeletedAt,
} from 'sequelize-typescript';
import { ServiceRequest } from './ServiceRequest';

// `paranoid` makes archive a soft delete so a generated report can be moved to
// the admin Archive view for restore or permanent deletion.
@Table({
  tableName: 'reports',
  timestamps: true,
  underscored: true,
  updatedAt: false,
  paranoid: true,
})
export class Report extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => ServiceRequest)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'service_request_id',
  })
  declare serviceRequestId: number | null;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    field: 'report_type',
  })
  declare reportType: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare summary: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'generated_date',
  })
  declare generatedDate: Date;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  /** Set when the admin archives the report; cleared on restore. */
  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;

  // Associations
  @BelongsTo(() => ServiceRequest, 'serviceRequestId')
  declare serviceRequest: ServiceRequest;
}
