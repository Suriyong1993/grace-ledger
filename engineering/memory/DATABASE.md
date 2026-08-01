# Shared Project Brain — Database Specification

## Primary Entities

- `churches`: Church tenant scope (`id`, `name`, `tax_id`, `created_at`)
- `users`: User identity & role (`id`, `email`, `role`, `name`, `pin_hash`)
- `funds`: Financial funds (`id`, `church_id`, `name`, `opening_balance`)
- `expenses`: Expense records (`id`, `church_id`, `fund_id`, `amount`, `status`, `date`)
- `incomes`: Income records (`id`, `church_id`, `fund_id`, `amount`, `date`)
- `offerings`: Sunday offering entries (`id`, `church_id`, `fund_id`, `member_id`, `amount`)
- `audit_logs`: SHA-256 verifiable action stream (`id`, `church_id`, `user_name`, `action`, `at`)
