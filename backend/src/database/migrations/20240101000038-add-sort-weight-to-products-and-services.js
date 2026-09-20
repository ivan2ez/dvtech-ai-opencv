'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Admin-controlled display priority. Higher values sort first on the public
    // pages: for products it stands in for "best-selling", for services it
    // stands in for "most-availed". Existing rows default to 0 so ordering is
    // unchanged until an admin sets a weight.
    await queryInterface.addColumn('aircon_products', 'sort_weight', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('service_types', 'sort_weight', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('aircon_products', 'sort_weight');
    await queryInterface.removeColumn('service_types', 'sort_weight');
  },
};
