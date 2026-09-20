import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

/**
 * Persistent record of failed login attempts per email, used for account
 * lockout. Persisting this (rather than an in-memory map) means lockout state
 * survives restarts and is shared across multiple server instances.
 */
@Table({
  tableName: 'login_attempts',
  timestamps: true,
  underscored: true,
})
export class LoginAttempt extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'failed_attempts',
  })
  declare failedAttempts: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'locked_until',
  })
  declare lockedUntil: Date | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;
}
