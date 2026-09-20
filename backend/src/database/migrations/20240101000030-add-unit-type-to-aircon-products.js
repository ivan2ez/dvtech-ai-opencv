'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Compressor technology of the unit, chosen via radio buttons on the
    // Add/Edit Product form. Existing rows default to 'non-inverter' since
    // that is the conservative assumption for an unlabelled catalog entry.
    const columns = await queryInterface.describeTable('aircon_products');
    if (!columns.unit_type) {
      await queryInterface.addColumn('aircon_products', 'unit_type', {
        type: Sequelize.ENUM('inverter', 'non-inverter'),
        allowNull: false,
        defaultValue: 'non-inverter',
      });
    }

    // Back-fill from the model name where it already advertises "inverter",
    // so the catalog doesn't need to be re-entered by hand.
    await queryInterface.sequelize.query(
      "UPDATE aircon_products SET unit_type = 'inverter' WHERE LOWER(model) LIKE '%inverter%' AND LOWER(model) NOT LIKE '%non-inverter%' AND LOWER(model) NOT LIKE '%non inverter%'"
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('aircon_products', 'unit_type');
  },
};
