import { client } from './api-client.js';
import { YnabCliError } from './errors.js';
import type { HistoryEntry, OperationType } from './history.js';

export const NON_UNDOABLE_OPS = new Set<OperationType>(['delete_scheduled_transaction']);

export async function executeUndo(entry: HistoryEntry): Promise<unknown> {
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
