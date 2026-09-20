'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('service_requests', 'service_street', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('service_requests', 'service_barangay', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('service_requests', 'service_city', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('service_requests', 'service_province', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('service_requests', 'service_street');
    await queryInterface.removeColumn('service_requests', 'service_barangay');
    await queryInterface.removeColumn('service_requests', 'service_city');
    await queryInterface.removeColumn('service_requests', 'service_province');
  },
};
