#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b9540b70366be9f47415b7113dd563222405c69577714dd1d030f71b7943f5be/contract';
import startContract from '../../snapshots/b9540b70366be9f47415b7113dd563222405c69577714dd1d030f71b7943f5be/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/eea99f6636a76cdb594c7ecbc4813bfb9647a1144e1905a838ab7e617b2bd6ba/contract';
import endContract from '../../snapshots/eea99f6636a76cdb594c7ecbc4813bfb9647a1144e1905a838ab7e617b2bd6ba/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'dataRequest',
        columns: [
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('requestedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
