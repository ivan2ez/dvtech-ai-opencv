import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
} from 'sequelize-typescript';
import { RoomAssessment } from './RoomAssessment';
import { AirconProduct } from './AirconProduct';

@Table({
  tableName: 'ai_recommendations',
  timestamps: true,
  underscored: true,
  updatedAt: false,
})
export class AiRecommendation extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => RoomAssessment)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    unique: true,
    field: 'room_assessment_id',
  })
  declare roomAssessmentId: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'total_btu',
  })
  declare totalBtu: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'recommended_hp',
  })
  declare recommendedHp: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    field: 'unit_type',
  })
  declare unitType: string;

  @ForeignKey(() => AirconProduct)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'product_id',
  })
  declare productId: number | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'troubleshooting_notes',
  })
  declare troubleshootingNotes: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare reasoning: string;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  // Associations
  @BelongsTo(() => RoomAssessment, 'roomAssessmentId')
  declare roomAssessment: RoomAssessment;

  @BelongsTo(() => AirconProduct, 'productId')
  declare airconProduct: AirconProduct;
}
