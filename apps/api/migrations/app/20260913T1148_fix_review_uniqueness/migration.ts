#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1771a0a46534d13a322c63f072ebb0a1f01ca9550bf7873dcfcf03b5eb4e217d/contract';
import endContract from '../../snapshots/1771a0a46534d13a322c63f072ebb0a1f01ca9550bf7873dcfcf03b5eb4e217d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7f034ffd78a8a85ed574933bb22b0ff03b4a2d7471e1aa8b7019f3fa2c49b63b/contract';
import startContract from '../../snapshots/7f034ffd78a8a85ed574933bb22b0ff03b4a2d7471e1aa8b7019f3fa2c49b63b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({ schema: 'public', table: 'review', constraint: 'review_orderId_key' }),
      this.addUnique({
        schema: 'public',
        table: 'review',
        constraint: 'review_orderId_reviewerId_key',
        columns: ['orderId', 'reviewerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'review',
        index: 'review_orderId_idx_d284871b',
        columns: ['orderId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
