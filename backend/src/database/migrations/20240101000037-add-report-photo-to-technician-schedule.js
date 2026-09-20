'use strict';

/**
 * Adds technician_schedule.report_photo_path — the required photo a technician
 * attaches to a completion report (per the revisions, both notes AND a photo
 * are required to complete a task). Nullable so historical completed rows,
 * which predate this requirement, remain valid.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('technician_schedule', 'report_photo_path', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('technician_schedule', 'report_photo_path');
  },
};
