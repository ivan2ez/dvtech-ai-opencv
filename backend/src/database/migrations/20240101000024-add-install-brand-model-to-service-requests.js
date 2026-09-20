'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Optional AC unit selection captured for Installation service requests so
    // the assigned technician knows which brand/model to install.
    await queryInterface.addColumn('service_requests', 'install_brand', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn('service_requests', 'install_model', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('service_requests', 'install_model');
    await queryInterface.removeColumn('service_requests', 'install_brand');
  },
};
