import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
} from 'sequelize-typescript';
import { AirconProduct } from './AirconProduct';

@Table({
  tableName: 'product_images',
  timestamps: true,
  underscored: true,
  updatedAt: false,
})
export class ProductImage extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => AirconProduct)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'product_id',
  })
  declare productId: number;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
    field: 'image_url',
  })
  declare imageUrl: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_cover',
  })
  declare isCover: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'sort_order',
  })
  declare sortOrder: number;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @BelongsTo(() => AirconProduct, 'productId')
  declare product: AirconProduct;
}
