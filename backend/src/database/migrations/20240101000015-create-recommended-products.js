'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('recommended_products', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      ai_recommendation_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ai_recommendations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'aircon_products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      rank: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Ranking order (1 = primary recommendation, 2 = second option, 3 = third option, etc.)',
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indicates if this is the primary/best recommendation',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add composite unique index to prevent duplicate product recommendations per AI recommendation
    await queryInterface.addIndex('recommended_products', ['ai_recommendation_id', 'product_id'], {
      unique: true,
      name: 'recommended_products_ai_recommendation_id_product_id_unique',
    });

    // Add index on ai_recommendation_id for faster lookups
    await queryInterface.addIndex('recommended_products', ['ai_recommendation_id'], {
      name: 'recommended_products_ai_recommendation_id_index',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('recommended_products');
  },
};
