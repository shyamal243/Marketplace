#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3dee15e36b7a87816fa6d1b6863278f70329a7296240031ddd579887d3bf2729/contract';
import endContract from '../../snapshots/3dee15e36b7a87816fa6d1b6863278f70329a7296240031ddd579887d3bf2729/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/3f85f8eab2acfb2127e57e28ee0f78a9bccac442e18b13db9e5ac7beca9857c0/contract';
import startContract from '../../snapshots/3f85f8eab2acfb2127e57e28ee0f78a9bccac442e18b13db9e5ac7beca9857c0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('currentLatitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('currentLongitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('isAvailableForDelivery', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
