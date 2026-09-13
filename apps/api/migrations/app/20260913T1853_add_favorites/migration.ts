#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5bf9bda6461c58a9fe3a63a44562c3cd966549471b6df0ae7f1f4bac1faa4cb4/contract';
import startContract from '../../snapshots/5bf9bda6461c58a9fe3a63a44562c3cd966549471b6df0ae7f1f4bac1faa4cb4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b0c57b37eee7c45ba340a236186fe7c095494c38b2d7734ae1a516ababba66d1/contract';
import endContract from '../../snapshots/b0c57b37eee7c45ba340a236186fe7c095494c38b2d7734ae1a516ababba66d1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'favorite',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('storeId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'favorite',
        constraint: 'favorite_userId_storeId_productId_key',
        columns: ['userId', 'storeId', 'productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favorite',
        index: 'favorite_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favorite',
        index: 'favorite_storeId_idx_c545737d',
        columns: ['storeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favorite',
        index: 'favorite_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favorite',
        foreignKey: {
          name: 'favorite_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favorite',
        foreignKey: {
          name: 'favorite_storeId_fkey',
          columns: ['storeId'],
          references: { schema: 'public', table: 'store', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favorite',
        foreignKey: {
          name: 'favorite_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'product', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
