#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/22edbb92394319c1b1e95256ef772d3b141f531e42b446e8a0d5bc894d982541/contract';
import endContract from '../../snapshots/22edbb92394319c1b1e95256ef772d3b141f531e42b446e8a0d5bc894d982541/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7d66984584dedb5e749f12dd61ab7aec8b1152c858553002144d6f77b756b486/contract';
import startContract from '../../snapshots/7d66984584dedb5e749f12dd61ab7aec8b1152c858553002144d6f77b756b486/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('rentalEndOtp', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('rentalEndOtpVerifiedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('rentalHours', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('rentalStartOtp', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('rentalStartOtpVerifiedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
