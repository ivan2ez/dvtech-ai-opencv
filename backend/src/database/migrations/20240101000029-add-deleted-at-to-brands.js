'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Soft-delete marker so deleted brands move to the Brands Archive, where an
    // admin can restore them or remove them permanently.
    const columns = await queryInterface.describeTable('brands');
    if (!columns.deleted_at) {
      await queryInterface.addColumn('brands', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('brands');
    if (!indexes.some((index) => index.name === 'idx_brands_deleted_at')) {
      await queryInterface.addIndex('brands', ['deleted_at'], {
        name: 'idx_brands_deleted_at',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('brands', 'idx_brands_deleted_at');
    await queryInterface.removeColumn('brands', 'deleted_at');
  },
};
