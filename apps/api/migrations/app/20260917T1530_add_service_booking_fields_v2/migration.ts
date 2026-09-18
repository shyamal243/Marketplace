#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3fc8a5b269d315c6f0a7b6a15959fa7f4c0d6d5a5b71497bdf4d93ffa9514dc8/contract';
import endContract from '../../snapshots/3fc8a5b269d315c6f0a7b6a15959fa7f4c0d6d5a5b71497bdf4d93ffa9514dc8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/bbd987222dd865e87dbd9e72f044ae40da5c7f361afea734147ba3153e1c2eb1/contract';
import startContract from '../../snapshots/bbd987222dd865e87dbd9e72f044ae40da5c7f361afea734147ba3153e1c2eb1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('hoursBooked', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('professionalSkillId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('scheduleType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'order',
        column: col('scheduledFor', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
