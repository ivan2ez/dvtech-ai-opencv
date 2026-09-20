/**
 * PBT Scaffolding Sanity Test
 *
 * Confirms the property-based testing infrastructure added in task 2.1 works:
 *  - `fast-check` runs a property to a minimum of 100 iterations.
 *  - Jest discovers `*.property.test.ts` files.
 *  - The in-memory SQLite Sequelize harness supports a fresh sync per case for
 *    DB-backed properties.
 *
 * This file is scaffolding only; the 23 numbered correctness properties are
 * implemented in their own tasks.
 */

import fc from 'fast-check';
import { createTestSequelize } from './utils';

describe('PBT scaffolding', () => {
  it('runs a pure-function property to at least 100 iterations', () => {
    let runs = 0;
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        runs += 1;
        // Addition is commutative — a trivially true invariant used only to
        // prove the harness executes generated cases.
        return a + b === b + a;
      }),
      { numRuns: 100 },
    );
    expect(runs).toBeGreaterThanOrEqual(100);
  });

  it('runs a DB-backed property against fresh in-memory SQLite per case', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          email: fc.emailAddress(),
          role: fc.constantFrom('customer', 'admin', 'technician'),
        }),
        async ({ name, email, role }) => {
          // Fresh sync per case — the schema must not carry state across cases.
          const { sequelize, models } = await createTestSequelize();
          try {
            const created = await models.User.create({
              name,
              email,
              password: 'hashed',
              role,
              isActive: true,
            } as any);

            const found = await models.User.findByPk(created.id);
            // Round-trips: the row we wrote is the row we read back, and the
            // table started empty (fresh sync).
            const count = await models.User.count();
            return (
              found !== null &&
              found.get('email') === email &&
              count === 1
            );
          } finally {
            await sequelize.close();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
