---
name: ynab
description: >
  Manage YNAB budgets — query accounts, transactions, categories, and spending.
  Use when the user asks about their budget, finances, spending, transactions,
  categories, accounts, or anything YNAB-related.
user-invocable: false
---

# YNAB Integration

This plugin provides two interfaces to YNAB. All amounts are in **dollars** (not milliunits).

## MCP Tools vs CLI

This plugin registers an MCP server with ~35 tools. **Prefer MCP tools** — they are
auto-discovered, type-safe, and don't require shell execution. Use the CLI only when:
- You need shell composability (piping, jq, scripting)
- You need a feature the MCP tools don't expose (e.g., `--fields` filtering, transaction search)
- The MCP server is unavailable

Key MCP tools: `list_budgets`, `list_accounts`, `list_transactions`, `get_transaction`,
`create_transaction`, `update_transaction`, `delete_transaction`, `summarize_transactions`,
`list_categories`, `update_category`, `update_month_category`, `list_payees`, `update_payee`,
`find_transfer_candidates`, `search_tools` (to discover others).

## Authentication

Stored in OS keychain. Check with `ynab auth status`.

## Budget Selection

Priority: `--budget <id>` flag > config default > `YNAB_BUDGET_ID` env var.
MCP tools use `budgetId` parameter (optional — uses default if omitted).

Set a default to avoid passing budget ID every time:
```bash
ynab budgets list                    # find budget ID
ynab budgets set-default <id>        # set it once
```

## CLI Reference

### Common Queries

```bash
ynab budgets view                    # budget overview
ynab accounts list                   # accounts and balances
ynab transactions list --since 2026-03-01
ynab accounts transactions <account-id> --since 2026-03-01
ynab transactions search --payee-name "Amazon"
ynab transactions search --memo "coffee"
ynab transactions list --min-amount 50 --max-amount 200 --approved=false
ynab transactions list --fields id,date,amount,payee_name,category_name
ynab categories list
ynab months view 2026-03             # month detail with category budgets
```

### Write Operations

```bash
# Create transaction (negative = outflow, positive = inflow)
ynab transactions create --account <id> --amount -45.50 --date 2026-03-13 \
  --payee-name "Store" --category <id> --memo "Groceries"

ynab transactions update <id> --amount -50.00 --memo "Updated memo"
ynab transactions delete <id>

# Update category budget for a month
ynab categories budget <category-id> --month 2026-03-01 --amount 500

# Rename payee
ynab payees update <id> --name "New Name"
```

## Safety Rules

- **Confirm with the user before any write operation** (create, update, delete)
- For bulk operations, show a preview of changes before executing
- YNAB rate limit: 200 requests/hour — avoid unnecessary repeated calls
- Use `--fields` or `fields` parameter to reduce output size when listing transactions

## Tips

- Amounts are always in dollars: `--amount -25.50` means $25.50 outflow
- Dates use YYYY-MM-DD format
- Use `--compact` flag for minified CLI JSON output
- CLI list commands return arrays directly (not wrapped in objects)
- The `--since` / `sinceDate` parameter supports delta queries to reduce data
- Raw API access: `ynab api GET /budgets/{budget_id}/accounts`
