#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/822f65ddf5954fada1ee7087f556bcfc130942e4518406066bc46753c61391ab/contract';
import endContract from '../../snapshots/822f65ddf5954fada1ee7087f556bcfc130942e4518406066bc46753c61391ab/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b0c57b37eee7c45ba340a236186fe7c095494c38b2d7734ae1a516ababba66d1/contract';
import startContract from '../../snapshots/b0c57b37eee7c45ba340a236186fe7c095494c38b2d7734ae1a516ababba66d1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('referralCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('referralRewarded', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('referredBy', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_referralCode_key',
        columns: ['referralCode'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
