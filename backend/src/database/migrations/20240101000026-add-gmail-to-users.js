'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // The customer's Gmail address, used as the notification channel and the
    // destination for the 6-digit OTP that verifies account ownership.
    // Nullable so pre-existing accounts remain valid; new registrations always
    // supply it and can only complete once the OTP has been verified.
    await queryInterface.addColumn('users', 'gmail', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    // Timestamp of the successful OTP verification. NULL means "not verified".
    await queryInterface.addColumn('users', 'gmail_verified_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addIndex('users', ['gmail'], {
      name: 'idx_users_gmail',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'idx_users_gmail');
    await queryInterface.removeColumn('users', 'gmail_verified_at');
    await queryInterface.removeColumn('users', 'gmail');
  },
};
