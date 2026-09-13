#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/822f65ddf5954fada1ee7087f556bcfc130942e4518406066bc46753c61391ab/contract';
import startContract from '../../snapshots/822f65ddf5954fada1ee7087f556bcfc130942e4518406066bc46753c61391ab/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e8fe871d9ddb1ced6cda9bd7ced8841bf2925844b97e5a32d11ff761fc09d3eb/contract';
import endContract from '../../snapshots/e8fe871d9ddb1ced6cda9bd7ced8841bf2925844b97e5a32d11ff761fc09d3eb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
