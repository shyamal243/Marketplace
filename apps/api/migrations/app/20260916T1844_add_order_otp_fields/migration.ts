#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3ea955b210e31e838371c729af2094f3bb84e342f1d6451320f40b32edffd1c0/contract';
import startContract from '../../snapshots/3ea955b210e31e838371c729af2094f3bb84e342f1d6451320f40b32edffd1c0/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a5030651aa5145229bb1a9cb72f8ca6e7515de0e4275686cff785d4f823cf7aa/contract';
import endContract from '../../snapshots/a5030651aa5145229bb1a9cb72f8ca6e7515de0e4275686cff785d4f823cf7aa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('checkoutOtp', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('checkoutOtpVerifiedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('deliveryOtp', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('deliveryOtpVerifiedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('otpRequired', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('category', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
