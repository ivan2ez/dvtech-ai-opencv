'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_recommendations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      room_assessment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'room_assessments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      total_btu: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      recommended_hp: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      unit_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'aircon_products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      troubleshooting_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reasoning: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('ai_recommendations', ['room_assessment_id'], {
      unique: true,
      name: 'idx_ai_recommendations_room_assessment_id',
    });

    await queryInterface.addIndex('ai_recommendations', ['product_id'], {
      name: 'idx_ai_recommendations_product_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_recommendations');
  },
};
