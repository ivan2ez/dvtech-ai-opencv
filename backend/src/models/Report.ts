import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
} from 'sequelize-typescript';
import { ServiceRequest } from './ServiceRequest';

@Table({
  tableName: 'reports',
  timestamps: true,
  underscored: true,
  updatedAt: false,
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

  // Associations
  @BelongsTo(() => ServiceRequest, 'serviceRequestId')
  declare serviceRequest: ServiceRequest;
}
