#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b9540b70366be9f47415b7113dd563222405c69577714dd1d030f71b7943f5be/contract';
import endContract from '../../snapshots/b9540b70366be9f47415b7113dd563222405c69577714dd1d030f71b7943f5be/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/cf5e905b4cfd36a835d20d01e5ecf5712bb46d8a3d9f59baf2083a2db676e3b9/contract';
import startContract from '../../snapshots/cf5e905b4cfd36a835d20d01e5ecf5712bb46d8a3d9f59baf2083a2db676e3b9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'riskFlag',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entityId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resolved', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
