#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3b2d6895b83f9135284cdf89ac723dcb3db3acc3453db16eae16e015c0bd792f/contract';
import endContract from '../../snapshots/3b2d6895b83f9135284cdf89ac723dcb3db3acc3453db16eae16e015c0bd792f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/66825b19379b5ad3dce4d78bef0a83d72b4bf07b4402d69a19c6e8e13d618acc/contract';
import startContract from '../../snapshots/66825b19379b5ad3dce4d78bef0a83d72b4bf07b4402d69a19c6e8e13d618acc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'processedPayment',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('razorpayPaymentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'processedPayment',
        constraint: 'processedPayment_razorpayPaymentId_key',
        columns: ['razorpayPaymentId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
