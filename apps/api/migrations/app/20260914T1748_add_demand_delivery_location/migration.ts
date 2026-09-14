#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3dee15e36b7a87816fa6d1b6863278f70329a7296240031ddd579887d3bf2729/contract';
import startContract from '../../snapshots/3dee15e36b7a87816fa6d1b6863278f70329a7296240031ddd579887d3bf2729/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/3ea955b210e31e838371c729af2094f3bb84e342f1d6451320f40b32edffd1c0/contract';
import endContract from '../../snapshots/3ea955b210e31e838371c729af2094f3bb84e342f1d6451320f40b32edffd1c0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'demand',
        column: col('deliveryAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'demand',
        column: col('deliveryLatitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'demand',
        column: col('deliveryLongitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
