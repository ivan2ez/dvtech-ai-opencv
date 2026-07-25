import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasOne,
  CreatedAt,
} from 'sequelize-typescript';
import { ServiceRequest } from './ServiceRequest';
import { AiRecommendation } from './AiRecommendation';
import { User } from './User';

@Table({
  tableName: 'room_assessments',
  timestamps: true,
  underscored: true,
  updatedAt: false,
})
export class RoomAssessment extends Model {
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

  @ForeignKey(() => ServiceRequest)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    unique: true,
    field: 'service_request_id',
  })
  declare serviceRequestId: number | null;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  declare area: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'ceiling_height',
  })
  declare ceilingHeight: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare occupancy: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    field: 'sunlight_level',
  })
  declare sunlightLevel: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
    field: 'image_path',
  })
  declare imagePath: string | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  // Associations
  @BelongsTo(() => User, 'userId')
  declare user: User;

  @BelongsTo(() => ServiceRequest, 'serviceRequestId')
  declare serviceRequest: ServiceRequest;

  @HasOne(() => AiRecommendation, 'roomAssessmentId')
  declare aiRecommendation: AiRecommendation;
}
