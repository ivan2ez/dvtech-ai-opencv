'use strict';

/**
 * Canonicalises existing account emails to lowercase.
 *
 * Emails are case-insensitive identifiers: name@gmail.com and NaMe@gmail.com are
 * the same mailbox, so they must resolve to the same account when logging in and
 * must collide when registering. Every write path now lowercases before storing
 * and comparing, but rows created earlier (notably admin-created technicians,
 * which skipped normalisation) may still hold mixed case.
 *
 * Relying on MySQL's case-insensitive default collation to paper over this would
 * make the behaviour dialect-dependent — the SQLite dev fallback compares TEXT
 * case-sensitively and would fail to match. Normalising the stored data makes
 * lookups correct on any dialect.
 *
 * Rows whose lowercased address would collide with another account are left
 * untouched and reported, so a human can merge them deliberately rather than
 * having this migration silently drop an account.
 */

/** Lowercases a column's values row-by-row, skipping collisions. */
async function normalizeColumn(queryInterface, column) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT id, ${column} AS value FROM users WHERE ${column} IS NOT NULL AND ${column} <> ''`
  );

  // Group by canonical (lowercased) value to find would-be duplicates.
  const byCanonical = new Map();
  for (const row of rows) {
    const canonical = String(row.value).trim().toLowerCase();
    if (!byCanonical.has(canonical)) byCanonical.set(canonical, []);
    byCanonical.get(canonical).push(row);
  }

  const conflicts = [];
  let updated = 0;

  for (const [canonical, group] of byCanonical) {
    if (group.length > 1) {
      conflicts.push({ canonical, ids: group.map((r) => r.id) });
      continue;
    }

    const [row] = group;
    if (String(row.value) === canonical) continue; // already canonical

    await queryInterface.sequelize.query(
      `UPDATE users SET ${column} = :canonical WHERE id = :id`,
      { replacements: { canonical, id: row.id } }
    );
    updated += 1;
  }

  if (updated > 0) {
    console.log(`[migration] Normalised ${updated} users.${column} value(s) to lowercase.`);
  }

  for (const conflict of conflicts) {
    console.warn(
      `[migration] Skipped users.${column} "${conflict.canonical}": ` +
        `held by multiple accounts (ids ${conflict.ids.join(', ')}). ` +
        'Resolve these manually — they resolve to the same mailbox.'
    );
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await normalizeColumn(queryInterface, 'email');
    await normalizeColumn(queryInterface, 'gmail');
  },

  async down() {
    // Original casing is not recorded, so this cannot be reversed. Lowercase
    // addresses remain valid for every code path, so there is nothing to undo.
  },
};
