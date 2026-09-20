'use strict';

/**
 * Adds a nullable `deleted_at` column to the record tables that gain an admin
 * Archive (paranoid soft delete): service requests, technician schedule,
 * reports, service types, aircon products, and BTU factors. A NULL value means
 * the row is live; a timestamp means it has been archived and is hidden from
 * default queries until restored or permanently deleted.
 *
 * @type {import('sequelize-cli').Migration}
 */
const TABLES = [
  'service_requests',
  'technician_schedule',
  'reports',
  'service_types',
  'aircon_products',
  'btu_factors',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES) {
      await queryInterface.addColumn(table, 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    for (const table of TABLES) {
      await queryInterface.removeColumn(table, 'deleted_at');
    }
  },
};
