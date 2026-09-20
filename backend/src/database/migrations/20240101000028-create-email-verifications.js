'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Pending 6-digit OTP challenges for Gmail verification.
    //
    // Rows are keyed by the target gmail address rather than by user_id because
    // registration issues an OTP *before* the account exists. For profile
    // changes the owning user is recorded in user_id so a code issued for one
    // account can never be redeemed by another.
    await queryInterface.createTable('email_verifications', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      gmail: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      purpose: {
        type: Sequelize.ENUM('registration', 'profile-update'),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      code_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      consumed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('email_verifications', ['gmail', 'purpose'], {
      name: 'idx_email_verifications_gmail_purpose',
    });

    await queryInterface.addIndex('email_verifications', ['expires_at'], {
      name: 'idx_email_verifications_expires_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_verifications');
  },
};
