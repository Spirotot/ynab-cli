import { describe, expect, it, vi, beforeEach } from 'vitest';
import { YnabCliError } from './errors.js';
import type { HistoryEntry } from './history.js';

vi.mock('./api-client.js', () => ({
  client: {
    deleteTransaction: vi.fn().mockResolvedValue({ id: 'tx-1', deleted: true }),
    updateTransaction: vi.fn().mockResolvedValue({ id: 'tx-1' }),
    createTransaction: vi.fn().mockResolvedValue({ id: 'tx-new' }),
    updateCategory: vi.fn().mockResolvedValue({ id: 'cat-1' }),
    updateMonthCategory: vi.fn().mockResolvedValue({ id: 'cat-1' }),
    updatePayee: vi.fn().mockResolvedValue({ id: 'payee-1' }),
  },
}));

import { executeUndo, NON_UNDOABLE_OPS } from './undo.js';
import { client } from './api-client.js';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'entry-1',
    timestamp: '2026-03-13T00:00:00.000Z',
    budgetId: 'budget-1',
    operation: 'create_transaction',
    status: 'success',
    entityId: 'tx-1',
    ...overrides,
  };
}

describe('executeUndo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('undoes create_transaction by deleting', async () => {
    const entry = makeEntry({ operation: 'create_transaction', entityId: 'tx-1' });
    await executeUndo(entry);
    expect(client.deleteTransaction).toHaveBeenCalledWith('tx-1', 'budget-1');
  });

  it('undoes update_transaction by restoring before state', async () => {
    const beforeState = { id: 'tx-1', amount: 50000, memo: 'original' };
    const entry = makeEntry({
      operation: 'update_transaction',
      entityId: 'tx-1',
      beforeState,
    });
    await executeUndo(entry);
    expect(client.updateTransaction).toHaveBeenCalledWith(
      'tx-1',
      { transaction: beforeState },
      'budget-1'
    );
  });

  it('undoes delete_transaction by recreating', async () => {
    const beforeState = { id: 'tx-1', account_id: 'acc-1', date: '2026-03-01', amount: -10000 };
    const entry = makeEntry({
      operation: 'delete_transaction',
      entityId: 'tx-1',
      beforeState,
    });
    await executeUndo(entry);
    expect(client.createTransaction).toHaveBeenCalledWith(
      { transaction: beforeState },
      'budget-1'
    );
  });

  it('undoes update_category by restoring before state', async () => {
    const beforeState = { name: 'Groceries', note: 'food', category_group_id: 'grp-1' };
    const entry = makeEntry({
      operation: 'update_category',
      entityId: 'cat-1',
      beforeState,
    });
    await executeUndo(entry);
    expect(client.updateCategory).toHaveBeenCalledWith(
      'cat-1',
      { category: beforeState },
      'budget-1'
    );
  });

  it('undoes update_month_category by restoring budgeted amount', async () => {
    const entry = makeEntry({
      operation: 'update_month_category',
      entityId: 'cat-1',
      beforeState: { budgeted: 100000 },
      month: '2026-03-01',
    });
    await executeUndo(entry);
    expect(client.updateMonthCategory).toHaveBeenCalledWith(
      '2026-03-01',
      'cat-1',
      { category: { budgeted: 100000 } },
      'budget-1'
    );
  });

  it('undoes update_payee by restoring name', async () => {
    const entry = makeEntry({
      operation: 'update_payee',
      entityId: 'payee-1',
      beforeState: { name: 'Original Store' },
    });
    await executeUndo(entry);
    expect(client.updatePayee).toHaveBeenCalledWith(
      'payee-1',
      { payee: { name: 'Original Store' } },
      'budget-1'
    );
  });

  it('throws for delete_scheduled_transaction (not undoable)', async () => {
    const entry = makeEntry({
      operation: 'delete_scheduled_transaction',
      entityId: 'sched-1',
    });
    await expect(executeUndo(entry)).rejects.toThrow(YnabCliError);
    await expect(executeUndo(entry)).rejects.toThrow(/Cannot undo scheduled transaction/);
  });

  it('throws when update_transaction has no before state', async () => {
    const entry = makeEntry({ operation: 'update_transaction' });
    await expect(executeUndo(entry)).rejects.toThrow('No before state recorded for undo');
  });

  it('throws when delete_transaction has no before state', async () => {
    const entry = makeEntry({ operation: 'delete_transaction' });
    await expect(executeUndo(entry)).rejects.toThrow('No before state recorded for undo');
  });

  it('throws when update_category has no before state', async () => {
    const entry = makeEntry({ operation: 'update_category' });
    await expect(executeUndo(entry)).rejects.toThrow('No before state recorded for undo');
  });

  it('throws when update_month_category has no month', async () => {
    const entry = makeEntry({
      operation: 'update_month_category',
      beforeState: { budgeted: 100000 },
    });
    await expect(executeUndo(entry)).rejects.toThrow('No before state or month');
  });

  it('throws when update_payee has no before state', async () => {
    const entry = makeEntry({ operation: 'update_payee' });
    await expect(executeUndo(entry)).rejects.toThrow('No before state recorded for undo');
  });
});

describe('NON_UNDOABLE_OPS', () => {
  it('includes delete_scheduled_transaction', () => {
    expect(NON_UNDOABLE_OPS.has('delete_scheduled_transaction')).toBe(true);
  });

  it('does not include regular transaction ops', () => {
    expect(NON_UNDOABLE_OPS.has('create_transaction')).toBe(false);
    expect(NON_UNDOABLE_OPS.has('update_transaction')).toBe(false);
    expect(NON_UNDOABLE_OPS.has('delete_transaction')).toBe(false);
  });
});
