import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  HasOne,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { ServiceRequest } from './ServiceRequest';
import { TechnicianDetail } from './TechnicianDetail';
import { TechnicianSchedule } from './TechnicianSchedule';
import { BtuFactor } from './BtuFactor';

@Table({
  tableName: 'users',
  timestamps: true,
  underscored: true,
})
export class User extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare password: string;

  @Column({
    type: DataType.ENUM('admin', 'technician', 'customer'),
    allowNull: false,
    defaultValue: 'customer',
  })
  declare role: 'admin' | 'technician' | 'customer';

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  // Associations
  @HasMany(() => ServiceRequest, 'userId')
  declare serviceRequests: ServiceRequest[];

  @HasOne(() => TechnicianDetail, 'userId')
  declare technicianDetail: TechnicianDetail;

  @HasMany(() => TechnicianSchedule, 'technicianId')
  declare technicianSchedules: TechnicianSchedule[];

  @HasMany(() => BtuFactor, 'userId')
  declare btuFactors: BtuFactor[];
}
