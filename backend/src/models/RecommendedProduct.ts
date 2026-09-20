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
import { AiRecommendation } from './AiRecommendation';
import { AirconProduct } from './AirconProduct';

@Table({
  tableName: 'recommended_products',
  timestamps: true,
  underscored: true,
})
export class RecommendedProduct extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => AiRecommendation)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'ai_recommendation_id',
  })
  declare aiRecommendationId: number;

  @ForeignKey(() => AirconProduct)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'product_id',
  })
  declare productId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare rank: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_primary',
  })
  declare isPrimary: boolean;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => AiRecommendation, 'aiRecommendationId')
  declare aiRecommendation: AiRecommendation;

  @BelongsTo(() => AirconProduct, 'productId')
  declare product: AirconProduct;
}
