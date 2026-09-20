'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Soft-delete marker for the account archive. A non-NULL value moves the
    // account out of the active records table and into the Archive, where an
    // admin can Restore it or delete it permanently.
    const columns = await queryInterface.describeTable('users');
    if (!columns.deleted_at) {
      await queryInterface.addColumn('users', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('users');
    if (!indexes.some((index) => index.name === 'idx_users_deleted_at')) {
      await queryInterface.addIndex('users', ['deleted_at'], {
        name: 'idx_users_deleted_at',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'idx_users_deleted_at');
    await queryInterface.removeColumn('users', 'deleted_at');
  },
};
