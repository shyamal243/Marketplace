#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/387ace9e88e1ef3740ecbe494429664a1a54ad8a4cdddb83289f59f0031c9503/contract';
import startContract from '../../snapshots/387ace9e88e1ef3740ecbe494429664a1a54ad8a4cdddb83289f59f0031c9503/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9b5567febb5a61a605272ffdac288e8ec9b8a54eafa53c81de88b2e7a512292e/contract';
import endContract from '../../snapshots/9b5567febb5a61a605272ffdac288e8ec9b8a54eafa53c81de88b2e7a512292e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'storeAccess',
        columns: [
          col('assignedBySellerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('storeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'storeAccess',
        index: 'storeAccess_storeId_idx_c545737d',
        columns: ['storeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'storeAccess',
        index: 'storeAccess_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'storeAccess',
        foreignKey: {
          name: 'storeAccess_storeId_fkey',
          columns: ['storeId'],
          references: { schema: 'public', table: 'store', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'storeAccess',
        foreignKey: {
          name: 'storeAccess_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
