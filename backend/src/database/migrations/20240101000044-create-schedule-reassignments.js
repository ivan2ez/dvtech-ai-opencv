'use strict';

/**
 * Creates the `schedule_reassignments` audit table (Revision Batch 1, Req 9.5).
 * Each row records one reassignment of a technician_schedule: which schedule
 * moved, the previous technician, the new technician, the acting admin, and the
 * moment it happened. Rows are written inside the reassignment transaction so
 * the audit trail is all-or-nothing with the schedule's status/technician change
 * (Req 9.4).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('schedule_reassignments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      schedule_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'technician_schedule',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      previous_technician_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      new_technician_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      reassigned_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      reassigned_at: {
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
    });

    await queryInterface.addIndex('schedule_reassignments', ['schedule_id'], {
      name: 'idx_schedule_reassignments_schedule_id',
    });

    await queryInterface.addIndex('schedule_reassignments', ['previous_technician_id'], {
      name: 'idx_schedule_reassignments_previous_technician_id',
    });

    await queryInterface.addIndex('schedule_reassignments', ['new_technician_id'], {
      name: 'idx_schedule_reassignments_new_technician_id',
    });

    await queryInterface.addIndex('schedule_reassignments', ['reassigned_by'], {
      name: 'idx_schedule_reassignments_reassigned_by',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('schedule_reassignments');
  },
};
