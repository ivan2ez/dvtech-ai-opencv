'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // The half-day slot the customer picked alongside the required date.
    // Together they form the "Required Date and Time" the admin sees, and they
    // are what the technician-availability check is evaluated against.
    // Nullable so requests created before this field existed remain valid.
    const columns = await queryInterface.describeTable('service_requests');
    if (!columns.service_required_time) {
      await queryInterface.addColumn('service_requests', 'service_required_time', {
        type: Sequelize.ENUM('morning', 'afternoon'),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('service_requests', 'service_required_time');
  },
};
