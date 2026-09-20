'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('technician_schedule');

    if (!tableDescription.completed_at) {
      await queryInterface.addColumn('technician_schedule', 'completed_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('technician_schedule', 'completed_at');
  },
};
