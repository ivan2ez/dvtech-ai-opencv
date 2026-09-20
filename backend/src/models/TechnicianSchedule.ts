import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
} from 'sequelize-typescript';
import { User } from './User';
import { ServiceRequest } from './ServiceRequest';

// `paranoid` makes archive a soft delete so a schedule row can be moved to the
// admin Archive view for restore or permanent deletion.
@Table({
  tableName: 'technician_schedule',
  timestamps: true,
  underscored: true,
  paranoid: true,
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

  /**
   * Half-day slot the assignment covers. Mirrors the customer's chosen slot, or
   * the slot from an accepted reschedule proposal.
   */
  @Column({
    type: DataType.ENUM('morning', 'afternoon'),
    allowNull: true,
    field: 'scheduled_time',
  })
  declare scheduledTime: 'morning' | 'afternoon' | null;

  @Column({
    type: DataType.ENUM(
      'assigned',
      'accepted',
      'rejected',
      'reassigned',
      'in-progress',
      'completed'
    ),
    allowNull: false,
    defaultValue: 'assigned',
  })
  declare status:
    | 'assigned'
    | 'accepted'
    | 'rejected'
    | 'reassigned'
    | 'in-progress'
    | 'completed';

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

  /** Path to the required completion photo (set when the task is completed). */
  @Column({
    type: DataType.STRING(500),
    allowNull: true,
    field: 'report_photo_path',
  })
  declare reportPhotoPath: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'rejection_reason',
  })
  declare rejectionReason: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'completed_at',
  })
  declare completedAt: Date | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  /** Set when the admin archives the schedule; cleared on restore. */
  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;

  // Associations
  @BelongsTo(() => User, 'technicianId')
  declare technician: User;

  @BelongsTo(() => ServiceRequest, 'serviceRequestId')
  declare serviceRequest: ServiceRequest;
}
