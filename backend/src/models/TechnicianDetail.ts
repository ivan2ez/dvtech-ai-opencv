import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from './User';

@Table({
  tableName: 'technician_details',
  timestamps: false,
  underscored: true,
})
export class TechnicianDetail extends Model {
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
    unique: true,
    field: 'user_id',
  })
  declare userId: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare specialization: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    field: 'contact_number',
  })
  declare contactNumber: string;

  @Column({
    type: DataType.ENUM('available', 'busy', 'unavailable'),
    allowNull: false,
    defaultValue: 'available',
    field: 'availability_status',
  })
  declare availabilityStatus: 'available' | 'busy' | 'unavailable';

  // Associations
  @BelongsTo(() => User, 'userId')
  declare user: User;
}
