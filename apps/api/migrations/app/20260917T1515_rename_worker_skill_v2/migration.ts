#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/256a25f122985c8ed081f72a62d6663ba2edbec45a3e2182dabafc1c5659c161/contract';
import startContract from '../../snapshots/256a25f122985c8ed081f72a62d6663ba2edbec45a3e2182dabafc1c5659c161/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bbd987222dd865e87dbd9e72f044ae40da5c7f361afea734147ba3153e1c2eb1/contract';
import endContract from '../../snapshots/bbd987222dd865e87dbd9e72f044ae40da5c7f361afea734147ba3153e1c2eb1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'workerSkill' }),
      this.createTable({
        schema: 'public',
        table: 'professionalSkill',
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
          col('professionalId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('skillName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'professionalSkill',
        index: 'professionalSkill_professionalId_idx_7628e7a5',
        columns: ['professionalId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'professionalSkill',
        foreignKey: {
          name: 'professionalSkill_professionalId_fkey',
          columns: ['professionalId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
