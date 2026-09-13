#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1251c8107b610ea93abedbb13fadad3db1e37026343a253199421f897d9781eb/contract';
import startContract from '../../snapshots/1251c8107b610ea93abedbb13fadad3db1e37026343a253199421f897d9781eb/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/eee9f513d71091ba14a7d3ef7a6697aeb4ff88f244c46ac00ff7c5693c378573/contract';
import endContract from '../../snapshots/eee9f513d71091ba14a7d3ef7a6697aeb4ff88f244c46ac00ff7c5693c378573/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('commissionAmount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('deliveryFeeAmount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
