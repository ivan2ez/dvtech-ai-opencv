import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
} from 'sequelize-typescript';
import { AiRecommendation } from './AiRecommendation';
import { ProductImage } from './ProductImage';

// `paranoid` makes archive a soft delete (row kept with `deleted_at`, hidden by
// default). Distinct from `isActive` (deactivate = hidden from the catalog but
// still a live record): archive moves it to a recycle bin for restore/purge.
@Table({
  tableName: 'aircon_products',
  timestamps: true,
  underscored: true,
  paranoid: true,
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

  /** Compressor technology, selected via the Unit Type radio buttons. */
  @Column({
    type: DataType.ENUM('inverter', 'non-inverter'),
    allowNull: false,
    defaultValue: 'non-inverter',
    field: 'unit_type',
  })
  declare unitType: 'inverter' | 'non-inverter';

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

  /**
   * Admin-controlled display priority for the public catalog. Higher values
   * appear first (a proxy for "best-selling"), so admins can promote the units
   * DVTech sells most. Ties fall back to price.
   */
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'sort_weight',
  })
  declare sortWeight: number;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  /** Set when the admin archives the product; cleared on restore. */
  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;

  // Associations
  @HasMany(() => AiRecommendation, 'productId')
  declare aiRecommendations: AiRecommendation[];

  @HasMany(() => ProductImage, 'productId')
  declare images: ProductImage[];
}
