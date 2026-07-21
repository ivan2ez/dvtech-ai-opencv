import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasOne,
  HasMany,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { User } from './User';
import { RoomAssessment } from './RoomAssessment';
import { TechnicianSchedule } from './TechnicianSchedule';
import { Report } from './Report';

@Table({
  tableName: 'service_requests',
  timestamps: true,
  underscored: true,
})
export class ServiceRequest extends Model {
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
    field: 'user_id',
  })
  declare userId: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    field: 'service_type',
  })
  declare serviceType: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'ac_details',
  })
  declare acDetails: string | null;

  @Column({
    type: DataType.ENUM('pending', 'approved', 'rejected', 'assigned', 'in-progress', 'completed'),
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: 'pending' | 'approved' | 'rejected' | 'assigned' | 'in-progress' | 'completed';

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => User, 'userId')
  declare user: User;

  @HasOne(() => RoomAssessment, 'serviceRequestId')
  declare roomAssessment: RoomAssessment;

  @HasMany(() => TechnicianSchedule, 'serviceRequestId')
  declare technicianSchedules: TechnicianSchedule[];

  @HasMany(() => Report, 'serviceRequestId')
  declare reports: Report[];
}
