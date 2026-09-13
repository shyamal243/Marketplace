#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8d36c9ed3a5bc8a7d1c01ed553732fe07d0d9b2ff3f1ff9f7655348aa5d41acc/contract';
import startContract from '../../snapshots/8d36c9ed3a5bc8a7d1c01ed553732fe07d0d9b2ff3f1ff9f7655348aa5d41acc/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e1b983f1bcd8b9679ad8b2d5286dc0726dea5b919536cb8ae1856a124b2f3357/contract';
import endContract from '../../snapshots/e1b983f1bcd8b9679ad8b2d5286dc0726dea5b919536cb8ae1856a124b2f3357/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'review',
        columns: [
          col('comment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('orderId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('rating', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('revieweeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reviewerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'review',
        constraint: 'review_orderId_key',
        columns: ['orderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'review',
        index: 'review_revieweeId_idx_00d8b149',
        columns: ['revieweeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'review',
        index: 'review_reviewerId_idx_25a27b4e',
        columns: ['reviewerId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'review',
        foreignKey: {
          name: 'review_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'order', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'review',
        foreignKey: {
          name: 'review_reviewerId_fkey',
          columns: ['reviewerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'review',
        foreignKey: {
          name: 'review_revieweeId_fkey',
          columns: ['revieweeId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
