#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3fc8a5b269d315c6f0a7b6a15959fa7f4c0d6d5a5b71497bdf4d93ffa9514dc8/contract';
import startContract from '../../snapshots/3fc8a5b269d315c6f0a7b6a15959fa7f4c0d6d5a5b71497bdf4d93ffa9514dc8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f40e4db2665a5df6af6b9d59cc8a79a75574f6dd9de0524a80394f99b4d65406/contract';
import endContract from '../../snapshots/f40e4db2665a5df6af6b9d59cc8a79a75574f6dd9de0524a80394f99b4d65406/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('dropAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('dropLatitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('dropLongitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('pickupAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('pickupLatitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('pickupLongitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('rideOtp', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('rideOtpVerifiedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('vehicleType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
