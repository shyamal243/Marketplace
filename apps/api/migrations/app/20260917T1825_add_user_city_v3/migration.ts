#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/22edbb92394319c1b1e95256ef772d3b141f531e42b446e8a0d5bc894d982541/contract';
import startContract from '../../snapshots/22edbb92394319c1b1e95256ef772d3b141f531e42b446e8a0d5bc894d982541/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/387ace9e88e1ef3740ecbe494429664a1a54ad8a4cdddb83289f59f0031c9503/contract';
import endContract from '../../snapshots/387ace9e88e1ef3740ecbe494429664a1a54ad8a4cdddb83289f59f0031c9503/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('city', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
