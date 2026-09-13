#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7f034ffd78a8a85ed574933bb22b0ff03b4a2d7471e1aa8b7019f3fa2c49b63b/contract';
import endContract from '../../snapshots/7f034ffd78a8a85ed574933bb22b0ff03b4a2d7471e1aa8b7019f3fa2c49b63b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/bb0e431b6dc542dd8c1d809092cd9ac47980d294b7c64f9405e4487705406be9/contract';
import startContract from '../../snapshots/bb0e431b6dc542dd8c1d809092cd9ac47980d294b7c64f9405e4487705406be9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'demand',
        column: col('bidWindowExpiresAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
