#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/48d381cfdeb2e66342e1fa98582133743ada4c5119555e0b83633cb3601ac1e2/contract';
import startContract from '../../snapshots/48d381cfdeb2e66342e1fa98582133743ada4c5119555e0b83633cb3601ac1e2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a4147b3f6497d0a708f1eaafc0d08877b3d757d8211f82f95be3ac8816d23589/contract';
import endContract from '../../snapshots/a4147b3f6497d0a708f1eaafc0d08877b3d757d8211f82f95be3ac8816d23589/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'store',
        column: col('businessRegistrationNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'store',
        column: col('fssaiLicenseNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
