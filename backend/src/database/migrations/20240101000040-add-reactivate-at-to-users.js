'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Timed-deactivation marker. When an admin deactivates an account for a
    // fixed span (1/2/3/4 days), this holds the moment it should auto-reactivate.
    // NULL means an indefinite ("forever") deactivation or an active account.
    // Reactivation is applied lazily on read, so no scheduled job is needed.
    await queryInterface.addColumn('users', 'reactivate_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'reactivate_at');
  },
};
