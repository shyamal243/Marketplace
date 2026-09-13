#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1771a0a46534d13a322c63f072ebb0a1f01ca9550bf7873dcfcf03b5eb4e217d/contract';
import startContract from '../../snapshots/1771a0a46534d13a322c63f072ebb0a1f01ca9550bf7873dcfcf03b5eb4e217d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9d3a158c1914fead4fe37e03bc07b6019f66d9852274cf157f3b135ff7b78c2e/contract';
import endContract from '../../snapshots/9d3a158c1914fead4fe37e03bc07b6019f66d9852274cf157f3b135ff7b78c2e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'product',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('price', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sellerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('stock', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'productRating',
        columns: [
          col('comment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('rating', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'productRating',
        constraint: 'productRating_productId_customerId_key',
        columns: ['productId', 'customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'product',
        index: 'product_sellerId_idx_d71255f2',
        columns: ['sellerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'productRating',
        index: 'productRating_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'productRating',
        index: 'productRating_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'product',
        foreignKey: {
          name: 'product_sellerId_fkey',
          columns: ['sellerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'productRating',
        foreignKey: {
          name: 'productRating_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'product', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'productRating',
        foreignKey: {
          name: 'productRating_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
