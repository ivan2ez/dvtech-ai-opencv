'use strict';

/**
 * Placeholder quotation status vocabulary, kept in lockstep with the
 * source-of-truth constants module `src/constants/quotationStatus.ts`
 * (Req 4.10, 5.2). The values MUST be inlined here rather than imported:
 * sequelize-cli executes migrations as plain CommonJS via Node, which cannot
 * `require` the TypeScript constants file. When `INQUIRY.DOCX` arrives, swap
 * both this list and the constants module together (plus a remap migration).
 */
const QUOTATION_STATUS = {
  Submitted: 'submitted',
  UnderReview: 'under-review',
  Quoted: 'quoted',
  Assigned: 'assigned',
  Paid: 'paid',
  Declined: 'declined',
};
const QUOTATION_STATUS_VALUES = Object.values(QUOTATION_STATUS);

/**
 * Creates the `quotations` table (Revision Batch 1, Req 4.3, 11.2 — C4 My
 * Quotations / A6 Manage Quotations).
 *
 * A quotation is a customer-submitted request for a price quote on a specific
 * aircon (brand + model + free-text details). It moves through the placeholder
 * status vocabulary mirrored above from `constants/quotationStatus.ts` and,
 * once paid, can be linked to a service_request for scheduling.
 *
 * The `status` ENUM is built from `QUOTATION_STATUS_VALUES` (Req 5); swapping
 * the constants + this migration is the only change needed when `INQUIRY.DOCX`
 * arrives. `deleted_at` gives the table paranoid soft-delete semantics matching
 * `service_requests`.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('quotations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      brand: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      model: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(...QUOTATION_STATUS_VALUES),
        allowNull: false,
        defaultValue: QUOTATION_STATUS.Submitted,
      },
      service_request_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'service_requests',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('quotations', ['user_id'], {
      name: 'idx_quotations_user_id',
    });

    await queryInterface.addIndex('quotations', ['service_request_id'], {
      name: 'idx_quotations_service_request_id',
    });

    await queryInterface.addIndex('quotations', ['status'], {
      name: 'idx_quotations_status',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('quotations');
    // Drop the ENUM type explicitly for Postgres-compatible dialects; harmless
    // on MySQL where the type is inlined into the column.
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_quotations_status";');
    }
  },
};
