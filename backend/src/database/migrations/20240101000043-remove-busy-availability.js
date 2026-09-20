'use strict';

/**
 * Narrows the `technician_details.availability_status` ENUM by removing the
 * `busy` value (Revision Batch 1, Req 13.1 / 13.2). Availability is reduced to
 * a simple `available` / `unavailable` toggle.
 *
 * Because MySQL rejects narrowing an ENUM while rows still hold the value being
 * dropped, `up()` FIRST converts every `busy` row to `available` (mandatory
 * data conversion so no row violates the narrowed ENUM), THEN alters the ENUM.
 * `down()` widens the ENUM back to include `busy`; no data conversion is needed
 * on the way down since `available`/`unavailable` remain valid.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Mandatory data conversion: collapse any `busy` rows to `available` so the
    // narrowed ENUM below does not orphan values outside the allowed set.
    await queryInterface.sequelize.query(
      "UPDATE technician_details SET availability_status = 'available' WHERE availability_status = 'busy'"
    );

    await queryInterface.changeColumn('technician_details', 'availability_status', {
      type: Sequelize.ENUM('available', 'unavailable'),
      allowNull: false,
      defaultValue: 'available',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('technician_details', 'availability_status', {
      type: Sequelize.ENUM('available', 'busy', 'unavailable'),
      allowNull: false,
      defaultValue: 'available',
    });
  },
};
