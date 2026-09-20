import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  HasOne,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
} from 'sequelize-typescript';
import { ServiceRequest } from './ServiceRequest';
import { TechnicianDetail } from './TechnicianDetail';
import { TechnicianSchedule } from './TechnicianSchedule';
import { BtuFactor } from './BtuFactor';

// `paranoid` turns Delete into a soft delete: the row stays in the table with
// `deleted_at` set and is excluded from every default query, which is exactly
// the Archive behaviour the admin account management screen needs. Queries that
// need to see archived rows must pass `paranoid: false` explicitly.
@Table({
  tableName: 'users',
  timestamps: true,
  underscored: true,
  paranoid: true,
})
export class User extends Model {
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
  declare name: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare password: string;

  @Column({
    type: DataType.ENUM('admin', 'technician', 'customer'),
    allowNull: false,
    defaultValue: 'customer',
  })
  declare role: 'admin' | 'technician' | 'customer';

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  /**
   * When set, a timed deactivation auto-reactivates the account at this moment.
   * NULL means the deactivation is indefinite ("forever") or the account is
   * active. Evaluated lazily on read (no background worker), so the account
   * flips back to active the next time it is listed or looked up after this
   * time passes.
   */
  @Column({ type: DataType.DATE, allowNull: true, field: 'reactivate_at' })
  declare reactivateAt: Date | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare street: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare barangay: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare city: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare province: string | null;

  @Column({ type: DataType.STRING(50), allowNull: true, field: 'contact_number' })
  declare contactNumber: string | null;

  /**
   * The Gmail address the account is verified against and where system
   * notifications are delivered. Required for customer accounts created after
   * the verification feature shipped; nullable for legacy rows.
   */
  @Column({ type: DataType.STRING(255), allowNull: true })
  declare gmail: string | null;

  /** When the OTP sent to `gmail` was successfully entered. NULL = unverified. */
  @Column({ type: DataType.DATE, allowNull: true, field: 'gmail_verified_at' })
  declare gmailVerifiedAt: Date | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  /** Set when the admin archives the account; cleared on restore. */
  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;

  // Associations
  @HasMany(() => ServiceRequest, 'userId')
  declare serviceRequests: ServiceRequest[];

  @HasOne(() => TechnicianDetail, 'userId')
  declare technicianDetail: TechnicianDetail;

  @HasMany(() => TechnicianSchedule, 'technicianId')
  declare technicianSchedules: TechnicianSchedule[];

  @HasMany(() => BtuFactor, 'userId')
  declare btuFactors: BtuFactor[];
}
