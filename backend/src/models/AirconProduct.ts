import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { AiRecommendation } from './AiRecommendation';
import { ProductImage } from './ProductImage';

@Table({
  tableName: 'aircon_products',
  timestamps: true,
  underscored: true,
})
export class AirconProduct extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare brand: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare model: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  declare type: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  declare horsepower: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'btu_capacity',
  })
  declare btuCapacity: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare price: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string | null;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
    field: 'image_url',
  })
  declare imageUrl: string | null;

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
  @HasMany(() => AiRecommendation, 'productId')
  declare aiRecommendations: AiRecommendation[];

  @HasMany(() => ProductImage, 'productId')
  declare images: ProductImage[];
}
