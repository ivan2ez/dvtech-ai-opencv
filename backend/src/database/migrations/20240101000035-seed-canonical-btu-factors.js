'use strict';

/**
 * Ensures the canonical BTU factor rows required by the deterministic BTU
 * calculator (btuCalculationService.ts) exist.
 *
 * The calculator looks factors up by these exact names. On databases that were
 * seeded before the calculator existed (with old names like "Base BTU per sqm"),
 * the formula would fall back to hard-coded defaults and edits wouldn't take
 * effect. This migration inserts any missing canonical rows without touching
 * or duplicating rows an admin may have already created.
 *
 * It is additive and idempotent: it only inserts names that are absent.
 */

const CANONICAL_FACTORS = [
  ['Room Area (per sqm)', 337, 'BTU per square meter of floor area (Area x 337).'],
  ['Ceiling Height (per meter above 2.5m)', 100, 'BTU per meter of ceiling height above the 2.5m baseline.'],
  ['Occupants (per person)', 600, 'BTU added per occupant.'],
  ['Sunlight (per level)', 500, 'BTU per sunlight level: low x1, medium x2, high x3.'],
  ['Television (per unit)', 400, 'BTU added per television.'],
  ['Desktop Computer (per unit)', 500, 'BTU added per desktop computer.'],
  ['Laptop (per unit)', 200, 'BTU added per laptop.'],
  ['Refrigerator (per unit)', 500, 'BTU added per refrigerator.'],
  ['Microwave Oven (per unit)', 1000, 'BTU added per microwave oven.'],
  ['Electric Fan (per unit)', 100, 'BTU added per electric fan.'],
  ['Printer (per unit)', 300, 'BTU added per printer.'],
  ['Lighting Fixtures (per fixture)', 100, 'BTU added per lighting fixture.'],
  ['Gaming PC (per unit)', 700, 'BTU added per gaming PC.'],
  ['Server / Network Equipment (per unit)', 1000, 'BTU added per server or network equipment rack.'],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Attach the rows to an admin user so the NOT NULL user_id is satisfied.
    const [adminRows] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
    );
    if (!adminRows || adminRows.length === 0) {
      console.warn('[migration] No admin user found; skipping canonical BTU factor seed.');
      return;
    }
    const adminId = adminRows[0].id;

    const [existingRows] = await queryInterface.sequelize.query(
      'SELECT factor_name FROM btu_factors'
    );
    const existingNames = new Set(
      (existingRows || []).map((r) => String(r.factor_name).trim().toLowerCase())
    );

    const now = new Date();
    const toInsert = CANONICAL_FACTORS.filter(
      ([name]) => !existingNames.has(name.trim().toLowerCase())
    ).map(([factor_name, factor_value, description]) => ({
      user_id: adminId,
      factor_name,
      factor_value,
      description,
      created_at: now,
      updated_at: now,
    }));

    if (toInsert.length === 0) {
      console.log('[migration] All canonical BTU factors already present.');
      return;
    }

    await queryInterface.bulkInsert('btu_factors', toInsert);
    console.log(`[migration] Inserted ${toInsert.length} canonical BTU factor(s).`);
  },

  async down(queryInterface, Sequelize) {
    // Remove only the canonical rows this migration could have added.
    const names = CANONICAL_FACTORS.map(([name]) => name);
    await queryInterface.bulkDelete('btu_factors', {
      factor_name: { [Sequelize.Op.in]: names },
    });
  },
};
