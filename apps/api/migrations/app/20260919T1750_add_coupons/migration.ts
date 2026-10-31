#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/604b739bf17327df8b7e3a4028daaa99541b623969cafa3fce65bc4eeff0d4d8/contract';
import startContract from '../../snapshots/604b739bf17327df8b7e3a4028daaa99541b623969cafa3fce65bc4eeff0d4d8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a9dac260180bd8f69fc1cf00f313fa29a1bea186428fa7a53b798d812d070c4d/contract';
import endContract from '../../snapshots/a9dac260180bd8f69fc1cf00f313fa29a1bea186428fa7a53b798d812d070c4d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'coupon',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('maxDiscount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('minOrderAmount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('perUserLimit', 'int4', { default: lit(1), codecRef: { codecId: 'pg/int4@1' } }),
          col('rewardType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('usageLimit', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('usedCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('value', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('valueType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'couponRedemption',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('couponId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('orderId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'coupon',
        constraint: 'coupon_code_key',
        columns: ['code'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'couponRedemption',
        index: 'couponRedemption_couponId_idx_a9dd19dc',
        columns: ['couponId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'couponRedemption',
        index: 'couponRedemption_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'couponRedemption',
        foreignKey: {
          name: 'couponRedemption_couponId_fkey',
          columns: ['couponId'],
          references: { schema: 'public', table: 'coupon', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'couponRedemption',
        foreignKey: {
          name: 'couponRedemption_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
