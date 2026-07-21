'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('technician_schedule', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      technician_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      service_request_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'service_requests',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      scheduled_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('assigned', 'accepted', 'rejected', 'in-progress', 'completed'),
        allowNull: false,
        defaultValue: 'assigned',
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium',
      },
      report: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('technician_schedule', ['technician_id'], {
      name: 'idx_technician_schedule_technician_id',
    });

    await queryInterface.addIndex('technician_schedule', ['service_request_id'], {
      name: 'idx_technician_schedule_service_request_id',
    });

    await queryInterface.addIndex('technician_schedule', ['scheduled_date'], {
      name: 'idx_technician_schedule_scheduled_date',
    });

    await queryInterface.addIndex('technician_schedule', ['status'], {
      name: 'idx_technician_schedule_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('technician_schedule');
  },
};
