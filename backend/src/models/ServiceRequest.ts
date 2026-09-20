import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasOne,
  HasMany,
  CreatedAt,
  UpdatedAt,
  DeletedAt,
} from 'sequelize-typescript';
import { User } from './User';
import { RoomAssessment } from './RoomAssessment';
import { TechnicianSchedule } from './TechnicianSchedule';
import { Report } from './Report';

/**
 * Lifecycle of a service request.
 *
 * The last three states belong to the rescheduling flow: when no technician is
 * available on the customer's chosen slot the admin proposes a new one
 * (`needs-rescheduling`), and the customer either accepts (→ `assigned`),
 * declines (`declined`), or lets the 48-hour window lapse (`expired`).
 */
export type ServiceRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'assigned'
  | 'in-progress'
  | 'completed'
  | 'needs-rescheduling'
  | 'declined'
  | 'expired';

/** Half-day slots the customer can book. */
export type ServiceTimeSlot = 'morning' | 'afternoon';

// `paranoid` makes admin Delete a soft delete (Archive): the row stays with
// `deleted_at` set and is hidden from default queries, so it can be restored or
// permanently removed. This is separate from the customer's own recycle bin
// (`customer_deleted_at`) and from the workflow statuses.
@Table({
  tableName: 'service_requests',
  timestamps: true,
  underscored: true,
  paranoid: true,
})
export class ServiceRequest extends Model {
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
    field: 'service_type',
  })
  declare serviceType: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'ac_details',
  })
  declare acDetails: string | null;

  @Column({
    type: DataType.ENUM(
      'pending',
      'approved',
      'rejected',
      'assigned',
      'in-progress',
      'completed',
      'needs-rescheduling',
      'declined',
      'expired'
    ),
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: ServiceRequestStatus;

  @Column({ type: DataType.STRING(255), allowNull: true, field: 'service_street' })
  declare serviceStreet: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true, field: 'service_barangay' })
  declare serviceBarangay: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true, field: 'service_city' })
  declare serviceCity: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true, field: 'service_province' })
  declare serviceProvince: string | null;

  @Column({ type: DataType.STRING(50), allowNull: true, field: 'contact_number' })
  declare contactNumber: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true, field: 'install_brand' })
  declare installBrand: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true, field: 'install_model' })
  declare installModel: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: true, field: 'service_required_date' })
  declare serviceRequiredDate: string | null;

  /**
   * Half-day slot chosen by the customer. Combined with `serviceRequiredDate`
   * this is the "Required Date and Time" shown to the admin, so the admin never
   * has to key a date in by hand.
   */
  @Column({
    type: DataType.ENUM('morning', 'afternoon'),
    allowNull: true,
    field: 'service_required_time',
  })
  declare serviceRequiredTime: ServiceTimeSlot | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'rejection_reason' })
  declare rejectionReason: string | null;

  // ── Rescheduling proposal ──────────────────────────────────────────────────
  // Populated when the admin proposes a new schedule. Kept separate from the
  // original required date/time so both can be shown side-by-side while the
  // customer decides, and so nothing is lost if they decline.

  @Column({ type: DataType.DATEONLY, allowNull: true, field: 'proposed_date' })
  declare proposedDate: string | null;

  @Column({
    type: DataType.ENUM('morning', 'afternoon'),
    allowNull: true,
    field: 'proposed_time',
  })
  declare proposedTime: ServiceTimeSlot | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'proposed_technician_id' })
  declare proposedTechnicianId: number | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: 'reschedule_reason' })
  declare rescheduleReason: string | null;

  /** SHA-256 of the single-use token in the customer's email action link. */
  @Column({ type: DataType.STRING(255), allowNull: true, field: 'reschedule_token_hash' })
  declare rescheduleTokenHash: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'reschedule_requested_at' })
  declare rescheduleRequestedAt: Date | null;

  /** Hard 48-hour deadline; past this with no response the request expires. */
  @Column({ type: DataType.DATE, allowNull: true, field: 'reschedule_expires_at' })
  declare rescheduleExpiresAt: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'reschedule_responded_at' })
  declare rescheduleRespondedAt: Date | null;

  /** Optional explanation the customer may add when declining the proposal. */
  @Column({ type: DataType.TEXT, allowNull: true, field: 'reschedule_decline_notes' })
  declare rescheduleDeclineNotes: string | null;

  /**
   * When set, the customer has moved this request to their personal recycle
   * bin. It is hidden from the customer's default list but can be restored or
   * permanently deleted by them. This is customer-scoped only — the admin's
   * view is unaffected, so it is deliberately NOT a paranoid/`deletedAt` column.
   */
  @Column({ type: DataType.DATE, allowNull: true, field: 'customer_deleted_at' })
  declare customerDeletedAt: Date | null;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  /** Set when the admin archives the request; cleared on restore. */
  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;

  // Associations
  @BelongsTo(() => User, 'userId')
  declare user: User;

  /** Technician earmarked for the proposed slot while a reschedule is pending. */
  @BelongsTo(() => User, { foreignKey: 'proposedTechnicianId', as: 'proposedTechnician' })
  declare proposedTechnician: User | null;

  @HasOne(() => RoomAssessment, 'serviceRequestId')
  declare roomAssessment: RoomAssessment;

  @HasMany(() => TechnicianSchedule, 'serviceRequestId')
  declare technicianSchedules: TechnicianSchedule[];

  @HasMany(() => Report, 'serviceRequestId')
  declare reports: Report[];
}
