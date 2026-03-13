import * as fs from 'fs/promises';
import * as path from 'path';

export type OperationType =
  | 'create_transaction'
  | 'update_transaction'
  | 'delete_transaction'
  | 'update_category'
  | 'update_month_category'
  | 'update_payee'
  | 'delete_scheduled_transaction';

export type HistoryEntryStatus = 'success' | 'undone' | 'undo_failed';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  budgetId: string;
  operation: OperationType;
  status: HistoryEntryStatus;
  entityId: string;
  beforeState?: Record<string, unknown>;
  month?: string;
}

const DEFAULT_MAX_ENTRIES = 100;

export class HistoryStore {
  private entries: HistoryEntry[] = [];
  private loaded = false;

  constructor(
    private readonly filePath: string = getDefaultHistoryPath(),
    private readonly maxEntries: number = DEFAULT_MAX_ENTRIES
  ) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed: unknown = JSON.parse(content);
      this.entries = Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
    } catch {
      this.entries = [];
    }
    this.loaded = true;
  }

  async add(entry: HistoryEntry): Promise<void> {
    await this.load();
    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }
    await this.save();
  }

  async getAll(): Promise<readonly HistoryEntry[]> {
    await this.load();
    return this.entries;
  }

  async get(id: string): Promise<HistoryEntry | undefined> {
    await this.load();
    return this.entries.find((e) => e.id === id);
  }

  async getMostRecent(): Promise<HistoryEntry | undefined> {
    await this.load();
    return this.entries.find((e) => e.status === 'success');
  }

  async updateStatus(id: string, status: HistoryEntryStatus): Promise<void> {
    await this.load();
    const index = this.entries.findIndex((e) => e.id === id);
    if (index === -1) throw new Error('History entry not found');
    this.entries[index] = { ...this.entries[index], status };
    await this.save();
  }

  async clear(): Promise<void> {
    this.entries = [];
    this.loaded = true;
    await this.save();
  }

  private async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.entries, null, 2));
  }
}

export function getDefaultHistoryPath(): string {
  const homeDir = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.';
  return path.join(homeDir, '.ynab-cli-history.json');
}

export function createHistoryEntry(
  operation: OperationType,
  budgetId: string,
  entityId: string,
  beforeState?: Record<string, unknown>,
  month?: string
): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    budgetId,
    operation,
    status: 'success',
    entityId,
    ...(beforeState && { beforeState }),
    ...(month && { month }),
  };
}

export const history = new HistoryStore();
