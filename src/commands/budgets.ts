import { Command } from 'commander';
import { client } from '../lib/api-client.js';
import { config } from '../lib/config.js';
import { outputJson } from '../lib/output.js';
import { YnabCliError } from '../lib/errors.js';
import { withErrorHandling } from '../lib/command-utils.js';

export function createBudgetsCommand(): Command {
  const cmd = new Command('budgets').description('Budget operations');

  cmd
    .command('list')
    .description('List all budgets')
    .option('--include-accounts', 'Include accounts in response')
    .action(
      withErrorHandling(async (options: { includeAccounts?: boolean }) => {
        const result = await client.getBudgets(options.includeAccounts);
        outputJson(result?.budgets);
      })
    );

  cmd
    .command('view')
    .description('View budget details (uses default if no id provided)')
    .argument('[id]', 'Budget ID')
    .action(
      withErrorHandling(async (id: string | undefined) => {
        const result = await client.getBudget(id);
        outputJson(result?.budget);
      })
    );

  cmd
    .command('settings')
    .description('View budget settings')
    .argument('[id]', 'Budget ID')
    .action(
      withErrorHandling(async (id: string | undefined) => {
        const settings = await client.getBudgetSettings(id);
        outputJson(settings);
      })
    );

  cmd
    .command('set-default')
    .description('Set default budget for commands')
    .argument('<id>', 'Budget ID')
    .action(
      withErrorHandling(async (id: string) => {
        const result = await client.getBudgets();
        const budget = result?.budgets.find((b: { id: string }) => b.id === id);

        if (!budget) {
          throw new YnabCliError(`Budget with ID ${id} not found`, 404);
        }

        config.setDefaultBudget(id);
        outputJson({
          message: 'Default budget set',
          budget: { id: budget.id, name: budget.name },
        });
      })
    );

  return cmd;
}
