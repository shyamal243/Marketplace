#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8b8d8373107bb3f1d75cdae3a5a2c8f6151be7acd4ebd8939f423943f4f12561/contract';
import endContract from '../../snapshots/8b8d8373107bb3f1d75cdae3a5a2c8f6151be7acd4ebd8939f423943f4f12561/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/eee9f513d71091ba14a7d3ef7a6697aeb4ff88f244c46ac00ff7c5693c378573/contract';
import startContract from '../../snapshots/eee9f513d71091ba14a7d3ef7a6697aeb4ff88f244c46ac00ff7c5693c378573/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'demand',
        column: col('hoursNeeded', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
