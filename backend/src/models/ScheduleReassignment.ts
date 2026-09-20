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
import { TechnicianSchedule } from './TechnicianSchedule';

/**
 * Audit trail for schedule reassignments (Revision Batch 1, Req 9.5). One row is
 * written each time an admin moves a technician_schedule to a different
 * technician, recording who it moved from, who it moved to, the acting admin,
 * and when. Rows are inserted inside the reassignment transaction so the audit
 * record is all-or-nothing with the schedule's status/technician change (Req 9.4).
 */
@Table({
  tableName: 'schedule_reassignments',
  timestamps: true,
  underscored: true,
})
export class ScheduleReassignment extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => TechnicianSchedule)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'schedule_id',
  })
  declare scheduleId: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'previous_technician_id',
  })
  declare previousTechnicianId: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'new_technician_id',
  })
  declare newTechnicianId: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'reassigned_by',
  })
  declare reassignedBy: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'reassigned_at',
  })
  declare reassignedAt: Date;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => TechnicianSchedule, 'scheduleId')
  declare schedule: TechnicianSchedule;

  @BelongsTo(() => User, 'previousTechnicianId')
  declare previousTechnician: User;

  @BelongsTo(() => User, 'newTechnicianId')
  declare newTechnician: User;

  @BelongsTo(() => User, 'reassignedBy')
  declare reassignedByUser: User;
}
