#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3f85f8eab2acfb2127e57e28ee0f78a9bccac442e18b13db9e5ac7beca9857c0/contract';
import endContract from '../../snapshots/3f85f8eab2acfb2127e57e28ee0f78a9bccac442e18b13db9e5ac7beca9857c0/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e8fe871d9ddb1ced6cda9bd7ced8841bf2925844b97e5a32d11ff761fc09d3eb/contract';
import startContract from '../../snapshots/e8fe871d9ddb1ced6cda9bd7ced8841bf2925844b97e5a32d11ff761fc09d3eb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'razorpayOrderMapping',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('razorpayOrderId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('referenceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'razorpayOrderMapping',
        constraint: 'razorpayOrderMapping_razorpayOrderId_key',
        columns: ['razorpayOrderId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
