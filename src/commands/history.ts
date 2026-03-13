import { Command } from 'commander';
import { history } from '../lib/history.js';
import { outputJson } from '../lib/output.js';
import { YnabCliError } from '../lib/errors.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { executeUndo, NON_UNDOABLE_OPS } from '../lib/undo.js';

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
