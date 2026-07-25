'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if user_id column already exists (from a previous partial migration)
    const tableInfo = await queryInterface.sequelize.query(
      "PRAGMA TABLE_INFO('room_assessments')",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const hasUserId = tableInfo.some((col) => col.name === 'user_id');

    if (!hasUserId) {
      // Add user_id column for direct ownership
      await queryInterface.addColumn('room_assessments', 'user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    // Backfill user_id from service_requests for existing records (SQLite syntax)
    await queryInterface.sequelize.query(`
      UPDATE room_assessments
      SET user_id = (
        SELECT sr.user_id FROM service_requests sr
        WHERE sr.id = room_assessments.service_request_id
      )
      WHERE user_id IS NULL AND service_request_id IS NOT NULL
    `);

    // SQLite doesn't support ALTER COLUMN for NOT NULL constraint.
    // The Sequelize model enforces allowNull: false at the application level.
    // For production MySQL deployments, add: ALTER TABLE room_assessments MODIFY user_id INT NOT NULL;

    // service_request_id is already nullable after the partial migration's table rebuild.
    // Add index on user_id if it doesn't exist
    try {
      await queryInterface.addIndex('room_assessments', ['user_id'], {
        name: 'idx_room_assessments_user_id',
      });
    } catch {
      // Index may already exist
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('room_assessments', 'idx_room_assessments_user_id');
    } catch {
      // ignore
    }
    try {
      await queryInterface.removeColumn('room_assessments', 'user_id');
    } catch {
      // ignore
    }
  },
};
