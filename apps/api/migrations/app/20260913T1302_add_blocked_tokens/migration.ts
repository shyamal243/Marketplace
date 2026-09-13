#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/9d3a158c1914fead4fe37e03bc07b6019f66d9852274cf157f3b135ff7b78c2e/contract';
import startContract from '../../snapshots/9d3a158c1914fead4fe37e03bc07b6019f66d9852274cf157f3b135ff7b78c2e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d38abafa16c21ab5035a542eea24b45a79fe32051eea2fbda3bd3c016149a82f/contract';
import endContract from '../../snapshots/d38abafa16c21ab5035a542eea24b45a79fe32051eea2fbda3bd3c016149a82f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'blockedToken',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('token', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'blockedToken',
        constraint: 'blockedToken_token_key',
        columns: ['token'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
