#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4bb7ba81e664ba3689719885ebbb7a910ac5a05cae8118894c304521a3476200/contract';
import startContract from '../../snapshots/4bb7ba81e664ba3689719885ebbb7a910ac5a05cae8118894c304521a3476200/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8d36c9ed3a5bc8a7d1c01ed553732fe07d0d9b2ff3f1ff9f7655348aa5d41acc/contract';
import endContract from '../../snapshots/8d36c9ed3a5bc8a7d1c01ed553732fe07d0d9b2ff3f1ff9f7655348aa5d41acc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'bid',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('demandId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sellerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
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
        table: 'order',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('bidId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('buyerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('demandId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sellerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('confirmed'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bid',
        index: 'bid_demandId_idx_e22a7856',
        columns: ['demandId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bid',
        index: 'bid_sellerId_idx_d71255f2',
        columns: ['sellerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order',
        index: 'order_bidId_idx_201f02a0',
        columns: ['bidId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order',
        index: 'order_buyerId_idx_80be0de9',
        columns: ['buyerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order',
        index: 'order_demandId_idx_e22a7856',
        columns: ['demandId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'order',
        index: 'order_sellerId_idx_d71255f2',
        columns: ['sellerId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bid',
        foreignKey: {
          name: 'bid_demandId_fkey',
          columns: ['demandId'],
          references: { schema: 'public', table: 'demand', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bid',
        foreignKey: {
          name: 'bid_sellerId_fkey',
          columns: ['sellerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order',
        foreignKey: {
          name: 'order_demandId_fkey',
          columns: ['demandId'],
          references: { schema: 'public', table: 'demand', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order',
        foreignKey: {
          name: 'order_bidId_fkey',
          columns: ['bidId'],
          references: { schema: 'public', table: 'bid', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order',
        foreignKey: {
          name: 'order_buyerId_fkey',
          columns: ['buyerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'order',
        foreignKey: {
          name: 'order_sellerId_fkey',
          columns: ['sellerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
