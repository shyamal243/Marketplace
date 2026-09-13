#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/54355b4ee622a1b0a99c7d4b20b67946dfbbd422c1cdc7cdfbb5a6a2e0527267/contract';
import endContract from '../../snapshots/54355b4ee622a1b0a99c7d4b20b67946dfbbd422c1cdc7cdfbb5a6a2e0527267/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5970733cd957f197dee0d032bc1624b27c5cf2ffce37be2d841c8891ae26fc88/contract';
import startContract from '../../snapshots/5970733cd957f197dee0d032bc1624b27c5cf2ffce37be2d841c8891ae26fc88/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'deliveryRating',
        columns: [
          col('comment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('deliveryAssignmentId', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('rating', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'deliveryTip',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('customerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('deliveryAssignmentId', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('deliveryPersonId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'gstRate',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ratePercent', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'demand',
        column: col('category', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('gstAmount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('gstCategory', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('gstRatePercent', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'deliveryRating',
        constraint: 'deliveryRating_deliveryAssignmentId_key',
        columns: ['deliveryAssignmentId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'deliveryTip',
        constraint: 'deliveryTip_deliveryAssignmentId_key',
        columns: ['deliveryAssignmentId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'gstRate',
        constraint: 'gstRate_category_key',
        columns: ['category'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deliveryRating',
        index: 'deliveryRating_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deliveryTip',
        index: 'deliveryTip_customerId_idx_b2a8a46c',
        columns: ['customerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deliveryTip',
        index: 'deliveryTip_deliveryPersonId_idx_02b8a2c8',
        columns: ['deliveryPersonId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deliveryRating',
        foreignKey: {
          name: 'deliveryRating_deliveryAssignmentId_fkey',
          columns: ['deliveryAssignmentId'],
          references: { schema: 'public', table: 'deliveryAssignment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deliveryRating',
        foreignKey: {
          name: 'deliveryRating_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deliveryTip',
        foreignKey: {
          name: 'deliveryTip_deliveryAssignmentId_fkey',
          columns: ['deliveryAssignmentId'],
          references: { schema: 'public', table: 'deliveryAssignment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deliveryTip',
        foreignKey: {
          name: 'deliveryTip_customerId_fkey',
          columns: ['customerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deliveryTip',
        foreignKey: {
          name: 'deliveryTip_deliveryPersonId_fkey',
          columns: ['deliveryPersonId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
