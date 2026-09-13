#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3b2d6895b83f9135284cdf89ac723dcb3db3acc3453db16eae16e015c0bd792f/contract';
import startContract from '../../snapshots/3b2d6895b83f9135284cdf89ac723dcb3db3acc3453db16eae16e015c0bd792f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5970733cd957f197dee0d032bc1624b27c5cf2ffce37be2d841c8891ae26fc88/contract';
import endContract from '../../snapshots/5970733cd957f197dee0d032bc1624b27c5cf2ffce37be2d841c8891ae26fc88/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'deliveryAssignment',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deliveryPersonId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('orderId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('assigned'),
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
        table: 'returnRequest',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('orderId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requestedById', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('requested'),
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
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('courierName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('deliveryMode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('trackingNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'deliveryAssignment',
        constraint: 'deliveryAssignment_orderId_key',
        columns: ['orderId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'returnRequest',
        constraint: 'returnRequest_orderId_key',
        columns: ['orderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deliveryAssignment',
        index: 'deliveryAssignment_deliveryPersonId_idx_02b8a2c8',
        columns: ['deliveryPersonId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'returnRequest',
        index: 'returnRequest_requestedById_idx_f9a56c66',
        columns: ['requestedById'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deliveryAssignment',
        foreignKey: {
          name: 'deliveryAssignment_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'order', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deliveryAssignment',
        foreignKey: {
          name: 'deliveryAssignment_deliveryPersonId_fkey',
          columns: ['deliveryPersonId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'returnRequest',
        foreignKey: {
          name: 'returnRequest_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'order', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'returnRequest',
        foreignKey: {
          name: 'returnRequest_requestedById_fkey',
          columns: ['requestedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
