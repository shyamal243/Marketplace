#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2bc92155b3451b0d6f3d143ce06faddf0d5a8fbcf34a1baee1f012432244c404/contract';
import endContract from '../../snapshots/2bc92155b3451b0d6f3d143ce06faddf0d5a8fbcf34a1baee1f012432244c404/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5970733cd957f197dee0d032bc1624b27c5cf2ffce37be2d841c8891ae26fc88/contract';
import startContract from '../../snapshots/5970733cd957f197dee0d032bc1624b27c5cf2ffce37be2d841c8891ae26fc88/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  placeholder,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'product',
        constraint: 'product_sellerId_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'product',
        index: 'product_sellerId_idx_d71255f2',
      }),
      this.dropColumn({ schema: 'public', table: 'product', column: 'sellerId' }),
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
      this.createTable({
        schema: 'public',
        table: 'orderItem',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('orderId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('priceAtPurchase', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'store',
        columns: [
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deliveryFeeBase', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('deliveryFeePerKm', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('latitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('longitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sellerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
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
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('orderType', 'text', {
          notNull: true,
          default: lit('bid_order'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('storeId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('storeId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),

      this.setNotNull({ schema: 'public', table: 'product', column: 'storeId' }),
      this.dropNotNull({ schema: 'public', table: 'order', column: 'bidId' }),
      this.dropNotNull({ schema: 'public', table: 'order', column: 'demandId' }),
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
      this.createIndex({
        schema: 'public',
        table: 'order',
        index: 'order_storeId_idx_c545737d',
        columns: ['storeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orderItem',
        index: 'orderItem_orderId_idx_d284871b',
        columns: ['orderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orderItem',
        index: 'orderItem_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'product',
        index: 'product_storeId_idx_c545737d',
        columns: ['storeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store',
        index: 'store_sellerId_idx_d71255f2',
        columns: ['sellerId'],
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
      this.addForeignKey({
        schema: 'public',
        table: 'orderItem',
        foreignKey: {
          name: 'orderItem_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'order', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orderItem',
        foreignKey: {
          name: 'orderItem_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'product', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store',
        foreignKey: {
          name: 'store_sellerId_fkey',
          columns: ['sellerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order',
        foreignKey: {
          name: 'order_storeId_fkey',
          columns: ['storeId'],
          references: { schema: 'public', table: 'store', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'product',
        foreignKey: {
          name: 'product_storeId_fkey',
          columns: ['storeId'],
          references: { schema: 'public', table: 'store', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
