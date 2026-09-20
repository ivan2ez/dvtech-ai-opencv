'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('users');
    const addressColumns = ['street', 'barangay', 'city', 'province'];

    for (const column of addressColumns) {
      if (!tableDescription[column]) {
        await queryInterface.addColumn('users', column, {
          type: Sequelize.STRING(255),
          allowNull: true,
        });
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'street');
    await queryInterface.removeColumn('users', 'barangay');
    await queryInterface.removeColumn('users', 'city');
    await queryInterface.removeColumn('users', 'province');
  },
};
