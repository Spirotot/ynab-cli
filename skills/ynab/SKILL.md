---
name: ynab
description: >
  Manage YNAB budgets — query accounts, transactions, categories, and spending.
  Use when the user asks about their budget, finances, spending, transactions,
  categories, accounts, or anything YNAB-related.
user-invocable: false
---

# YNAB CLI Reference

ynab-cli outputs JSON. All amounts are in **dollars** (not milliunits).

## Authentication

Stored in OS keychain. Check with `ynab auth status`.

## Budget Selection

Priority: `--budget <id>` flag > config default > `YNAB_BUDGET_ID` env var.

Set a default to avoid passing `--budget` every time:
```bash
ynab budgets list                    # find budget ID
ynab budgets set-default <id>        # set it once
```

## Common Queries

```bash
# Budget overview
ynab budgets view

# Accounts and balances
ynab accounts list

# Recent transactions
ynab transactions list --since 2026-03-01

# Transactions for a specific account
ynab accounts transactions <account-id> --since 2026-03-01

# Search by payee or memo
ynab transactions search --payee-name "Amazon"
ynab transactions search --memo "coffee"

# Filter by amount range and approval status
ynab transactions list --min-amount 50 --max-amount 200 --approved=false

# Select specific fields (reduces output)
ynab transactions list --fields id,date,amount,payee_name,category_name

# Spending summary (aggregated by payee and category)
# Available as MCP tool: summarize_transactions

# Categories and budgeted amounts
ynab categories list
ynab months view 2026-03    # month detail with category budgets
```

## Write Operations

```bash
# Create transaction (amount negative = outflow, positive = inflow)
ynab transactions create --account <id> --amount -45.50 --date 2026-03-13 \
  --payee-name "Store" --category <id> --memo "Groceries"

# Update transaction
ynab transactions update <id> --amount -50.00 --memo "Updated memo"

# Delete transaction
ynab transactions delete <id>

# Update category budget for a month
ynab categories budget <category-id> --month 2026-03-01 --amount 500

# Rename payee
ynab payees update <id> --name "New Name"
```

## Safety Rules

- **Confirm with the user before any write operation** (create, update, delete)
- For bulk operations, show a preview of changes before executing
- Use `--fields` to reduce output size when listing transactions
- YNAB rate limit: 200 requests/hour — avoid unnecessary repeated calls

## Tips

- Amounts are always in dollars: `--amount -25.50` means $25.50 outflow
- Dates use YYYY-MM-DD format
- Use `--compact` flag for minified JSON (useful for piping)
- List commands return arrays directly (not wrapped in objects)
- The `--since` flag on transaction lists supports delta queries to reduce data
- Scheduled transactions: `ynab scheduled list` / `ynab scheduled view <id>`
- Raw API access: `ynab api GET /budgets/{budget_id}/accounts`
