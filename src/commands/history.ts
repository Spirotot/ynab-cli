import { Command } from 'commander';
import { client } from '../lib/api-client.js';
import { history } from '../lib/history.js';
import { outputJson } from '../lib/output.js';
import { YnabCliError } from '../lib/errors.js';
import { withErrorHandling } from '../lib/command-utils.js';
import type { HistoryEntry } from '../lib/history.js';

const NON_UNDOABLE_OPS = new Set(['delete_scheduled_transaction']);

export function createHistoryCommand(): Command {
  const cmd = new Command('history').description('View and undo recent write operations');

  cmd
    .command('list')
    .description('List recent write operations')
    .option('-n, --limit <count>', 'Number of entries to show', parseInt)
    .action(
      withErrorHandling(async (options: { limit?: number }) => {
        let entries = await history.getAll();
        if (options.limit && options.limit > 0) {
          entries = entries.slice(0, options.limit);
        }
        outputJson(
          entries.map((e) => ({
            id: e.id,
            timestamp: e.timestamp,
            operation: e.operation,
            entityId: e.entityId,
            status: e.status,
            canUndo: e.status === 'success' && !NON_UNDOABLE_OPS.has(e.operation),
          }))
        );
      })
    );

  cmd
    .command('undo')
    .description('Undo the most recent write operation (or a specific one by ID)')
    .argument('[id]', 'History entry ID (defaults to most recent)')
    .action(
      withErrorHandling(async (id?: string) => {
        const entry = id ? await history.get(id) : await history.getMostRecent();

        if (!entry) {
          throw new YnabCliError(
            id ? `History entry ${id} not found` : 'No undoable operations in history',
            404
          );
        }

        if (entry.status === 'undone') {
          throw new YnabCliError('This operation has already been undone', 400);
        }

        if (entry.status === 'undo_failed') {
          throw new YnabCliError('Previous undo attempt for this operation failed', 400);
        }

        if (NON_UNDOABLE_OPS.has(entry.operation)) {
          throw new YnabCliError(
            `Cannot undo ${entry.operation}: YNAB API does not support this reversal`,
            400
          );
        }

        try {
          const result = await executeUndo(entry);
          await history.updateStatus(entry.id, 'undone');
          outputJson({
            message: `Successfully undone: ${entry.operation}`,
            undone_entry: entry.id,
            result,
          });
        } catch (error) {
          await history.updateStatus(entry.id, 'undo_failed');
          throw error;
        }
      })
    );

  cmd
    .command('clear')
    .description('Clear all history entries')
    .action(
      withErrorHandling(async () => {
        await history.clear();
        outputJson({ message: 'History cleared' });
      })
    );

  return cmd;
}

async function executeUndo(entry: HistoryEntry): Promise<unknown> {
  switch (entry.operation) {
    case 'create_transaction':
      return await client.deleteTransaction(entry.entityId, entry.budgetId);

    case 'update_transaction':
      if (!entry.beforeState) throw new YnabCliError('No before state recorded for undo', 400);
      return await client.updateTransaction(
        entry.entityId,
        { transaction: entry.beforeState },
        entry.budgetId
      );

    case 'delete_transaction':
      if (!entry.beforeState) throw new YnabCliError('No before state recorded for undo', 400);
      return await client.createTransaction(
        { transaction: entry.beforeState },
        entry.budgetId
      );

    case 'update_category':
      if (!entry.beforeState) throw new YnabCliError('No before state recorded for undo', 400);
      return await client.updateCategory(
        entry.entityId,
        { category: entry.beforeState },
        entry.budgetId
      );

    case 'update_month_category':
      if (!entry.beforeState || !entry.month)
        throw new YnabCliError('No before state or month recorded for undo', 400);
      return await client.updateMonthCategory(
        entry.month,
        entry.entityId,
        { category: { budgeted: entry.beforeState.budgeted as number } },
        entry.budgetId
      );

    case 'update_payee':
      if (!entry.beforeState) throw new YnabCliError('No before state recorded for undo', 400);
      return await client.updatePayee(
        entry.entityId,
        { payee: { name: entry.beforeState.name as string } },
        entry.budgetId
      );

    case 'delete_scheduled_transaction':
      throw new YnabCliError(
        'Cannot undo scheduled transaction deletion: YNAB API does not support creating scheduled transactions',
        400
      );
  }
}
