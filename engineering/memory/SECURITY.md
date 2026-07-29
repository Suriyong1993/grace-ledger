# Shared Project Brain — Security Specification

## Authentication & Authorization
- **Authentication**: 6-digit PIN code hashed and verified against identity records.
- **Role-Based Access Control (RBAC)**:
  - `admin`: Full system control and user management.
  - `treasurer`: Approval power for expenses and budget management.
  - `accountant`: Entry creation for incomes, expenses, and offerings.
  - `viewer`: Read-only access to financial reports.

## Cryptographic Audit Trail
- Audit entries record `user_name`, `action`, `entity`, `details`, `timestamp`.
- Optional SHA-256 hash linking entries in a cryptographic chain.
