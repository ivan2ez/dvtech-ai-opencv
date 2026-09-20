'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('technician_details');
    const addressColumns = ['street', 'barangay', 'city', 'province'];

    for (const column of addressColumns) {
      if (!tableDescription[column]) {
        await queryInterface.addColumn('technician_details', column, {
          type: Sequelize.STRING(255),
          allowNull: true,
        });
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('technician_details', 'street');
    await queryInterface.removeColumn('technician_details', 'barangay');
    await queryInterface.removeColumn('technician_details', 'city');
    await queryInterface.removeColumn('technician_details', 'province');
  },
};
