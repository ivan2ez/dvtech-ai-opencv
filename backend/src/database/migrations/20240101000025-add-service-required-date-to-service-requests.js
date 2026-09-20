'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // The customer's preferred/required date for the service to be performed.
    // Nullable so existing rows remain valid; new requests always supply it.
    await queryInterface.addColumn('service_requests', 'service_required_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('service_requests', 'service_required_date');
  },
};
