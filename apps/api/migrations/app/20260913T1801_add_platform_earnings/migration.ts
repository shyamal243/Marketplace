#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1251c8107b610ea93abedbb13fadad3db1e37026343a253199421f897d9781eb/contract';
import endContract from '../../snapshots/1251c8107b610ea93abedbb13fadad3db1e37026343a253199421f897d9781eb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/75cf4dda9ef2fd7716653c749a36197d5030dde469899a40d3094adf92b808e4/contract';
import startContract from '../../snapshots/75cf4dda9ef2fd7716653c749a36197d5030dde469899a40d3094adf92b808e4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'platformEarning',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('demandId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('orderId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
