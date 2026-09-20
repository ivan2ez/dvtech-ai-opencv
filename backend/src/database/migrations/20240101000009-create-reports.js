'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reports', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
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
      report_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      generated_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('reports', ['service_request_id'], {
      name: 'idx_reports_service_request_id',
    });

    await queryInterface.addIndex('reports', ['report_type'], {
      name: 'idx_reports_report_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reports');
  },
};
