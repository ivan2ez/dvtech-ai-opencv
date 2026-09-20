'use strict';

const RESCHEDULE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'assigned',
  'in-progress',
  'completed',
  'needs-rescheduling',
  'declined',
  'expired',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Widen the status enum for the rescheduling flow:
    //   needs-rescheduling — admin proposed a new schedule, awaiting the customer
    //   declined           — the customer rejected the proposal
    //   expired            — the customer did not respond within 48 hours
    await queryInterface.changeColumn('service_requests', 'status', {
      type: Sequelize.ENUM(...RESCHEDULE_STATUSES),
      allowNull: false,
      defaultValue: 'pending',
    });

    // The schedule the admin is proposing. Kept separate from
    // service_required_date/_time so the original request is still visible
    // side-by-side with the proposal until the customer responds.
    const columns = await queryInterface.describeTable('service_requests');
    const addColumnIfMissing = async (name, definition) => {
      if (!columns[name]) {
        await queryInterface.addColumn('service_requests', name, definition);
      }
    };

    await addColumnIfMissing('proposed_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await addColumnIfMissing('proposed_time', {
      type: Sequelize.ENUM('morning', 'afternoon'),
      allowNull: true,
    });

    // Optional technician earmarked for the proposed slot. Null means the admin
    // is proposing a new date without committing to a technician yet.
    await addColumnIfMissing('proposed_technician_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await addColumnIfMissing('reschedule_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // SHA-256 of the single-use token embedded in the customer's email link.
    await addColumnIfMissing('reschedule_token_hash', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await addColumnIfMissing('reschedule_requested_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Hard 48-hour deadline. Once passed with no response the request is
    // transitioned to 'expired'.
    await addColumnIfMissing('reschedule_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await addColumnIfMissing('reschedule_responded_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Free-text notes the customer may optionally add when declining.
    await addColumnIfMissing('reschedule_decline_notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Add the FK separately — TiDB cannot add a column and its foreign key in
    // the same ALTER TABLE statement. Guarded so a re-run after a partial
    // failure doesn't error on an already-existing constraint.
    try {
      await queryInterface.addConstraint('service_requests', {
        fields: ['proposed_technician_id'],
        type: 'foreign key',
        name: 'fk_service_requests_proposed_technician',
        references: { table: 'users', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    } catch (err) {
      // Ignore "constraint already exists" style errors so the migration is
      // idempotent across partial-failure re-runs.
      if (!/exist|duplicate/i.test(String(err && err.message))) {
        throw err;
      }
    }

    const indexes = await queryInterface.showIndex('service_requests');
    if (!indexes.some((index) => index.name === 'idx_service_requests_reschedule_token_hash')) {
      await queryInterface.addIndex('service_requests', ['reschedule_token_hash'], {
        name: 'idx_service_requests_reschedule_token_hash',
      });
    }

    if (!indexes.some((index) => index.name === 'idx_service_requests_reschedule_expires_at')) {
      await queryInterface.addIndex('service_requests', ['reschedule_expires_at'], {
        name: 'idx_service_requests_reschedule_expires_at',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      'service_requests',
      'idx_service_requests_reschedule_expires_at'
    );
    await queryInterface.removeIndex(
      'service_requests',
      'idx_service_requests_reschedule_token_hash'
    );
    await queryInterface.removeColumn('service_requests', 'reschedule_decline_notes');
    await queryInterface.removeColumn('service_requests', 'reschedule_responded_at');
    await queryInterface.removeColumn('service_requests', 'reschedule_expires_at');
    await queryInterface.removeColumn('service_requests', 'reschedule_requested_at');
    await queryInterface.removeColumn('service_requests', 'reschedule_token_hash');
    await queryInterface.removeColumn('service_requests', 'reschedule_reason');
    try {
      await queryInterface.removeConstraint(
        'service_requests',
        'fk_service_requests_proposed_technician'
      );
    } catch (err) {
      // constraint may not exist; ignore
    }
    await queryInterface.removeColumn('service_requests', 'proposed_technician_id');
    await queryInterface.removeColumn('service_requests', 'proposed_time');
    await queryInterface.removeColumn('service_requests', 'proposed_date');

    await queryInterface.changeColumn('service_requests', 'status', {
      type: Sequelize.ENUM(
        'pending',
        'approved',
        'rejected',
        'assigned',
        'in-progress',
        'completed'
      ),
      allowNull: false,
      defaultValue: 'pending',
    });
  },
};
