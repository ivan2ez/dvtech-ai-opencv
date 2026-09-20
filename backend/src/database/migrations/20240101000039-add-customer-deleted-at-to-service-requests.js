'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Customer-scoped "recycle bin" marker. When set, the request is hidden
    // from the customer's own list (but can be restored or permanently
    // deleted by them). Distinct from a paranoid deletedAt: the admin's view
    // must be unaffected, so this is a plain nullable timestamp.
    await queryInterface.addColumn('service_requests', 'customer_deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('service_requests', 'customer_deleted_at');
  },
};
