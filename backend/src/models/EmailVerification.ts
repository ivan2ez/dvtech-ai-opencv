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

/** What the OTP challenge is gating. */
export type VerificationPurpose = 'registration' | 'profile-update';

/**
 * A pending 6-digit OTP challenge for Gmail verification.
 *
 * Rows are keyed by the target Gmail address because a registration OTP is
 * issued before the user record exists. `userId` is set only for profile
 * changes, so a code issued for one account cannot be redeemed by another.
 * Only the SHA-256 hash of the code is stored.
 */
@Table({
  tableName: 'email_verifications',
  timestamps: true,
  underscored: true,
})
export class EmailVerification extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare gmail: string;

  @Column({
    type: DataType.ENUM('registration', 'profile-update'),
    allowNull: false,
  })
  declare purpose: VerificationPurpose;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'user_id',
  })
  declare userId: number | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    field: 'code_hash',
  })
  declare codeHash: string;

  /** Failed entry count, used to throttle brute-force guessing. */
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  declare attempts: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'expires_at',
  })
  declare expiresAt: Date;

  /** Set when the correct code was entered. */
  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'verified_at',
  })
  declare verifiedAt: Date | null;

  /**
   * Set when the verification was spent on an actual account create/update, so
   * one successful OTP cannot be replayed for a second change.
   */
  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'consumed_at',
  })
  declare consumedAt: Date | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => User, 'userId')
  declare user: User | null;
}
