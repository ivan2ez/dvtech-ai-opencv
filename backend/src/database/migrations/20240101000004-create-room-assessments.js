'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('room_assessments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      service_request_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'service_requests',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      area: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      ceiling_height: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      occupancy: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      sunlight_level: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      image_path: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('room_assessments', ['service_request_id'], {
      unique: true,
      name: 'idx_room_assessments_service_request_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('room_assessments');
  },
};
