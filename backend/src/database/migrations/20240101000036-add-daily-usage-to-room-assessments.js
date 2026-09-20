'use strict';

/**
 * Adds room_assessments.daily_usage — hours per day the AC runs (0-24).
 *
 * Used by the AI recommendation to advise inverter vs non-inverter: heavy daily
 * use favors an inverter for lower running cost. Nullable so assessments made
 * before this field remain valid.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('room_assessments', 'daily_usage', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('room_assessments', 'daily_usage');
  },
};
