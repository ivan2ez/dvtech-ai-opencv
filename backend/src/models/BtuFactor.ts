import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
} from 'sequelize-typescript';
import { User } from './User';

// `paranoid` makes archive a soft delete so a removed BTU factor can be
// restored or permanently deleted from the admin Archive view.
@Table({
  tableName: 'btu_factors',
  timestamps: true,
  underscored: true,
  paranoid: true,
})
export class BtuFactor extends Model {
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
    field: 'factor_name',
  })
  declare factorName: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'factor_value',
  })
  declare factorValue: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  /** Set when the admin archives the factor; cleared on restore. */
  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;

  // Associations
  @BelongsTo(() => User, 'userId')
  declare user: User;
}
