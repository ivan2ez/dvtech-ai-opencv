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
import { ServiceRequest } from './ServiceRequest';
import {
  QUOTATION_STATUS,
  QUOTATION_STATUS_VALUES,
  type QuotationStatus,
} from '../constants/quotationStatus';

/**
 * A customer-submitted request for a price quote on a specific aircon (C4 My
 * Quotations / A6 Manage Quotations — Req 4.3, 11.2).
 *
 * The `status` ENUM is built from `QUOTATION_STATUS_VALUES` so the vocabulary
 * stays single-sourced in `constants/quotationStatus.ts` (Req 5): the enum, the
 * default, and every consumer read from that one module, so swapping it when
 * `INQUIRY.DOCX` arrives is a one-file change plus a migration.
 *
 * `paranoid` gives admin Delete soft-delete semantics (row kept with
 * `deleted_at` set, hidden from default queries) matching `service_requests`.
 * `serviceRequestId` is nullable — a quotation links to a service_request only
 * once it has been paid and enters scheduling.
 */
@Table({
  tableName: 'quotations',
  timestamps: true,
  underscored: true,
  paranoid: true,
})
export class Quotation extends Model {
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
  })
  declare brand: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare model: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare details: string | null;

  @Column({
    type: DataType.ENUM(...QUOTATION_STATUS_VALUES),
    allowNull: false,
    defaultValue: QUOTATION_STATUS.Submitted,
  })
  declare status: QuotationStatus;

  @ForeignKey(() => ServiceRequest)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'service_request_id',
  })
  declare serviceRequestId: number | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'submitted_at',
  })
  declare submittedAt: Date;

  @CreatedAt
  @Column({ type: DataType.DATE, field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ type: DataType.DATE, field: 'updated_at' })
  declare updatedAt: Date;

  /** Set when an admin archives the quotation; cleared on restore. */
  @DeletedAt
  @Column({ type: DataType.DATE, field: 'deleted_at' })
  declare deletedAt: Date | null;

  // Associations
  @BelongsTo(() => User, 'userId')
  declare user: User;

  @BelongsTo(() => ServiceRequest, 'serviceRequestId')
  declare serviceRequest: ServiceRequest | null;
}
