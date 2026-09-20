'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('brands');

    if (!tableDescription.logo_url) {
      await queryInterface.addColumn('brands', 'logo_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
        after: 'name',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('brands', 'logo_url');
  },
};
