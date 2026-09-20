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
import { User } from './User';

@Table({
  tableName: 'password_reset_tokens',
  timestamps: true,
  underscored: true,
})
export class PasswordResetToken extends Model {
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
    type: DataType.STRING(255),
    allowNull: false,
    field: 'token_hash',
  })
  declare tokenHash: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'expires_at',
  })
  declare expiresAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'used_at',
  })
  declare usedAt: Date | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => User, 'userId')
  declare user: User;
}
