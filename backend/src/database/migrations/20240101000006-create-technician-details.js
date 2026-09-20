'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('technician_details', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      specialization: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      contact_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      availability_status: {
        type: Sequelize.ENUM('available', 'busy', 'unavailable'),
        allowNull: false,
        defaultValue: 'available',
      },
    });

    await queryInterface.addIndex('technician_details', ['user_id'], {
      unique: true,
      name: 'idx_technician_details_user_id',
    });

    await queryInterface.addIndex('technician_details', ['availability_status'], {
      name: 'idx_technician_details_availability_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('technician_details');
  },
};
