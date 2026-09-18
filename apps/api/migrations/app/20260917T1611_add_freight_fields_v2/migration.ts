#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4a8e59b4171004b28445aea4e5914d4ed99841a2d8c6dad45931c0edbf89b5d8/contract';
import endContract from '../../snapshots/4a8e59b4171004b28445aea4e5914d4ed99841a2d8c6dad45931c0edbf89b5d8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f40e4db2665a5df6af6b9d59cc8a79a75574f6dd9de0524a80394f99b4d65406/contract';
import startContract from '../../snapshots/f40e4db2665a5df6af6b9d59cc8a79a75574f6dd9de0524a80394f99b4d65406/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('isFreight', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('sizeCategory', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('weightKg', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
