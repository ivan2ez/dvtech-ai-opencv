import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from './User';
import { ServiceRequest } from './ServiceRequest';

@Table({
  tableName: 'technician_schedule',
  timestamps: true,
  underscored: true,
})
export class TechnicianSchedule extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'technician_id',
  })
  declare technicianId: number;

  @ForeignKey(() => ServiceRequest)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'service_request_id',
  })
  declare serviceRequestId: number;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    field: 'scheduled_date',
  })
  declare scheduledDate: string;

  @Column({
    type: DataType.ENUM('assigned', 'accepted', 'rejected', 'in-progress', 'completed'),
    allowNull: false,
    defaultValue: 'assigned',
  })
  declare status: 'assigned' | 'accepted' | 'rejected' | 'in-progress' | 'completed';

  @Column({
    type: DataType.ENUM('low', 'medium', 'high'),
    allowNull: false,
    defaultValue: 'medium',
  })
  declare priority: 'low' | 'medium' | 'high';

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare report: string | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => User, 'technicianId')
  declare technician: User;

  @BelongsTo(() => ServiceRequest, 'serviceRequestId')
  declare serviceRequest: ServiceRequest;
}
