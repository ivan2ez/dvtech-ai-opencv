'use strict';

/**
 * Extends the `technician_schedule.status` ENUM with a new `reassigned` value
 * so a schedule that an admin moves to a different technician can be marked
 * Reassigned (Revision Batch 1, Req 9.1) rather than being reset to `assigned`.
 * The new value is inserted before `in-progress`/`completed` to keep the ENUM
 * ordered along the task lifecycle. No existing rows change value, so this is a
 * pure widening of the allowed set.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('technician_schedule', 'status', {
      type: Sequelize.ENUM(
        'assigned',
        'accepted',
        'rejected',
        'reassigned',
        'in-progress',
        'completed'
      ),
      allowNull: false,
      defaultValue: 'assigned',
    });
  },

  async down(queryInterface, Sequelize) {
    // Fold any reassigned rows back to `assigned` before narrowing the ENUM,
    // otherwise the shrink would orphan values outside the allowed set.
    await queryInterface.sequelize.query(
      "UPDATE technician_schedule SET status = 'assigned' WHERE status = 'reassigned'"
    );

    await queryInterface.changeColumn('technician_schedule', 'status', {
      type: Sequelize.ENUM(
        'assigned',
        'accepted',
        'rejected',
        'in-progress',
        'completed'
      ),
      allowNull: false,
      defaultValue: 'assigned',
    });
  },
};
