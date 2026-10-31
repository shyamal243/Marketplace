#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/48d381cfdeb2e66342e1fa98582133743ada4c5119555e0b83633cb3601ac1e2/contract';
import endContract from '../../snapshots/48d381cfdeb2e66342e1fa98582133743ada4c5119555e0b83633cb3601ac1e2/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/eea99f6636a76cdb594c7ecbc4813bfb9647a1144e1905a838ab7e617b2bd6ba/contract';
import startContract from '../../snapshots/eea99f6636a76cdb594c7ecbc4813bfb9647a1144e1905a838ab7e617b2bd6ba/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'bid',
        column: col('linkedProductId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'bid',
        index: 'bid_linkedProductId_idx_ec65c60d',
        columns: ['linkedProductId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bid',
        foreignKey: {
          name: 'bid_linkedProductId_fkey',
          columns: ['linkedProductId'],
          references: { schema: 'public', table: 'product', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
