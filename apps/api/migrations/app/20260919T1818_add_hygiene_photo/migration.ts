#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a9dac260180bd8f69fc1cf00f313fa29a1bea186428fa7a53b798d812d070c4d/contract';
import startContract from '../../snapshots/a9dac260180bd8f69fc1cf00f313fa29a1bea186428fa7a53b798d812d070c4d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cf5e905b4cfd36a835d20d01e5ecf5712bb46d8a3d9f59baf2083a2db676e3b9/contract';
import endContract from '../../snapshots/cf5e905b4cfd36a835d20d01e5ecf5712bb46d8a3d9f59baf2083a2db676e3b9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'hygienePhoto',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('photoPath', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('storeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('uploadedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'hygienePhoto',
        index: 'hygienePhoto_storeId_idx_c545737d',
        columns: ['storeId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'hygienePhoto',
        foreignKey: {
          name: 'hygienePhoto_storeId_fkey',
          columns: ['storeId'],
          references: { schema: 'public', table: 'store', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
