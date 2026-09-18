#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4a8e59b4171004b28445aea4e5914d4ed99841a2d8c6dad45931c0edbf89b5d8/contract';
import startContract from '../../snapshots/4a8e59b4171004b28445aea4e5914d4ed99841a2d8c6dad45931c0edbf89b5d8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7d66984584dedb5e749f12dd61ab7aec8b1152c858553002144d6f77b756b486/contract';
import endContract from '../../snapshots/7d66984584dedb5e749f12dd61ab7aec8b1152c858553002144d6f77b756b486/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('copies', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('isColorPrint', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('pages', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('printFilePath', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'store',
        column: col('offersPrintService', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'store',
        column: col('printPricePerPageBw', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'store',
        column: col('printPricePerPageColor', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
