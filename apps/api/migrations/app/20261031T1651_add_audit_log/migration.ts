#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3ea955b210e31e838371c729af2094f3bb84e342f1d6451320f40b32edffd1c0/contract';
import startContract from '../../snapshots/3ea955b210e31e838371c729af2094f3bb84e342f1d6451320f40b32edffd1c0/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fd262b30dbf5a17e0fd04db95bdd76b3203b880b5a0a904ed14680a07c3a7c29/contract';
import endContract from '../../snapshots/fd262b30dbf5a17e0fd04db95bdd76b3203b880b5a0a904ed14680a07c3a7c29/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'auditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('details', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('targetId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('targetType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
