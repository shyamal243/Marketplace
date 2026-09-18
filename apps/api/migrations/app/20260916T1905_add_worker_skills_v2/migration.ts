#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/256a25f122985c8ed081f72a62d6663ba2edbec45a3e2182dabafc1c5659c161/contract';
import endContract from '../../snapshots/256a25f122985c8ed081f72a62d6663ba2edbec45a3e2182dabafc1c5659c161/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a5030651aa5145229bb1a9cb72f8ca6e7515de0e4275686cff785d4f823cf7aa/contract';
import startContract from '../../snapshots/a5030651aa5145229bb1a9cb72f8ca6e7515de0e4275686cff785d4f823cf7aa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'workerSkill',
        columns: [
          col('category', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('hourlyRate', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('skillName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('workerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'workerSkill',
        index: 'workerSkill_workerId_idx_0b8f3a7c',
        columns: ['workerId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'workerSkill',
        foreignKey: {
          name: 'workerSkill_workerId_fkey',
          columns: ['workerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
