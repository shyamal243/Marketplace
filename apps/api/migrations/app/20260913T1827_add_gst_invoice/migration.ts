#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5bf9bda6461c58a9fe3a63a44562c3cd966549471b6df0ae7f1f4bac1faa4cb4/contract';
import endContract from '../../snapshots/5bf9bda6461c58a9fe3a63a44562c3cd966549471b6df0ae7f1f4bac1faa4cb4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8b8d8373107bb3f1d75cdae3a5a2c8f6151be7acd4ebd8939f423943f4f12561/contract';
import startContract from '../../snapshots/8b8d8373107bb3f1d75cdae3a5a2c8f6151be7acd4ebd8939f423943f4f12561/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'gstInvoice',
        columns: [
          col('baseAmount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('buyerGstin', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('gstAmount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('invoiceNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('orderId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('totalAmount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'gstInvoice',
        constraint: 'gstInvoice_orderId_key',
        columns: ['orderId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'gstInvoice',
        constraint: 'gstInvoice_invoiceNumber_key',
        columns: ['invoiceNumber'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'gstInvoice',
        foreignKey: {
          name: 'gstInvoice_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'order', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
