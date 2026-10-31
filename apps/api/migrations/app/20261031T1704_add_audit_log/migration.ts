#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/42366d61ac23c716e7164567e3ba6a84d95eec3d3c9b8ff49ae55bc3ad9644b6/contract';
import endContract from '../../snapshots/42366d61ac23c716e7164567e3ba6a84d95eec3d3c9b8ff49ae55bc3ad9644b6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a4147b3f6497d0a708f1eaafc0d08877b3d757d8211f82f95be3ac8816d23589/contract';
import startContract from '../../snapshots/a4147b3f6497d0a708f1eaafc0d08877b3d757d8211f82f95be3ac8816d23589/contract.json' with { type: 'json' };
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
