#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/65479ef9a446702bd146c5313037483ba4ae209f6ff72460650cff6bb7d4b929/contract';
import endContract from '../../snapshots/65479ef9a446702bd146c5313037483ba4ae209f6ff72460650cff6bb7d4b929/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d38abafa16c21ab5035a542eea24b45a79fe32051eea2fbda3bd3c016149a82f/contract';
import startContract from '../../snapshots/d38abafa16c21ab5035a542eea24b45a79fe32051eea2fbda3bd3c016149a82f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('isPaid', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
