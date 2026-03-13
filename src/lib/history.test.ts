import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { HistoryStore, createHistoryEntry } from './history.js';

describe('HistoryStore', () => {
  let tmpDir: string;
  let historyPath: string;
  let store: HistoryStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ynab-history-test-'));
    historyPath = path.join(tmpDir, 'history.json');
    store = new HistoryStore(historyPath);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('starts with empty history when file does not exist', async () => {
    const entries = await store.getAll();
    expect(entries).toEqual([]);
  });

  it('adds and retrieves entries', async () => {
    const entry = createHistoryEntry('create_transaction', 'budget-1', 'tx-1');
    await store.add(entry);

    const entries = await store.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].operation).toBe('create_transaction');
    expect(entries[0].entityId).toBe('tx-1');
    expect(entries[0].status).toBe('success');
  });

  it('stores newest entries first', async () => {
    await store.add(createHistoryEntry('create_transaction', 'b', 'tx-1'));
    await store.add(createHistoryEntry('delete_transaction', 'b', 'tx-2'));

    const entries = await store.getAll();
    expect(entries[0].operation).toBe('delete_transaction');
    expect(entries[1].operation).toBe('create_transaction');
  });

  it('retrieves entry by id', async () => {
    const entry = createHistoryEntry('create_transaction', 'b', 'tx-1');
    await store.add(entry);

    const found = await store.get(entry.id);
    expect(found?.id).toBe(entry.id);
  });

  it('getMostRecent returns first success entry', async () => {
    const e1 = createHistoryEntry('create_transaction', 'b', 'tx-1');
    await store.add(e1);
    await store.updateStatus(e1.id, 'undone');

    const e2 = createHistoryEntry('update_transaction', 'b', 'tx-2');
    await store.add(e2);

    const recent = await store.getMostRecent();
    expect(recent?.id).toBe(e2.id);
  });

  it('updates entry status', async () => {
    const entry = createHistoryEntry('create_transaction', 'b', 'tx-1');
    await store.add(entry);
    await store.updateStatus(entry.id, 'undone');

    const updated = await store.get(entry.id);
    expect(updated?.status).toBe('undone');
  });

  it('evicts oldest entries when exceeding max', async () => {
    const smallStore = new HistoryStore(historyPath, 3);
    for (let i = 0; i < 5; i++) {
      await smallStore.add(createHistoryEntry('create_transaction', 'b', `tx-${i}`));
    }

    const entries = await smallStore.getAll();
    expect(entries).toHaveLength(3);
    expect(entries[0].entityId).toBe('tx-4');
  });

  it('persists to disk and reloads', async () => {
    await store.add(createHistoryEntry('create_transaction', 'b', 'tx-1'));

    const store2 = new HistoryStore(historyPath);
    const entries = await store2.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].entityId).toBe('tx-1');
  });

  it('clears all entries', async () => {
    await store.add(createHistoryEntry('create_transaction', 'b', 'tx-1'));
    await store.clear();

    const entries = await store.getAll();
    expect(entries).toEqual([]);
  });

  it('handles corrupt file gracefully', async () => {
    await fs.writeFile(historyPath, 'not json');
    const entries = await store.getAll();
    expect(entries).toEqual([]);
  });

  it('stores beforeState for update operations', async () => {
    const beforeState = { amount: 50000, memo: 'test' };
    const entry = createHistoryEntry('update_transaction', 'b', 'tx-1', beforeState);
    await store.add(entry);

    const found = await store.get(entry.id);
    expect(found?.beforeState).toEqual(beforeState);
  });

  it('stores month for update_month_category', async () => {
    const entry = createHistoryEntry('update_month_category', 'b', 'cat-1', { budgeted: 100000 }, '2026-03-01');
    await store.add(entry);

    const found = await store.get(entry.id);
    expect(found?.month).toBe('2026-03-01');
  });
});

describe('createHistoryEntry', () => {
  it('creates entry with required fields', () => {
    const entry = createHistoryEntry('create_transaction', 'budget-1', 'tx-123');
    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBeDefined();
    expect(entry.budgetId).toBe('budget-1');
    expect(entry.operation).toBe('create_transaction');
    expect(entry.status).toBe('success');
    expect(entry.entityId).toBe('tx-123');
    expect(entry.beforeState).toBeUndefined();
    expect(entry.month).toBeUndefined();
  });

  it('includes optional beforeState and month', () => {
    const entry = createHistoryEntry(
      'update_month_category',
      'b',
      'cat-1',
      { budgeted: 50000 },
      '2026-01-01'
    );
    expect(entry.beforeState).toEqual({ budgeted: 50000 });
    expect(entry.month).toBe('2026-01-01');
  });
});
