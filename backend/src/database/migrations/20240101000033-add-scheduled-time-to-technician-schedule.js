'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // The half-day slot the assignment covers. Set from the customer's chosen
    // slot on a normal assignment, or from the accepted proposal after a
    // reschedule, so the assignment records the exact agreed schedule.
    const columns = await queryInterface.describeTable('technician_schedule');
    if (!columns.scheduled_time) {
      await queryInterface.addColumn('technician_schedule', 'scheduled_time', {
        type: Sequelize.ENUM('morning', 'afternoon'),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('technician_schedule', 'scheduled_time');
  },
};
