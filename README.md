# Vault

Multi-company expense and income tracking. One organization, many companies, role-based access, budgets, and email reports.

## Read these first

1. [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — how to run it, the pages, and who can do what.
2. [QUERIES_AND_MUTATIONS.md](QUERIES_AND_MUTATIONS.md) — all 39 queries, 42 mutations, and the REST routes.
3. [DATABASE.md](DATABASE.md) — every MongoDB collection and how the rows relate.
4. [TEST_PLAN.md](TEST_PLAN.md) — what to test in each module.

## Layout

- `client/` — React app
- `server/` — GraphQL API
- `server/src/schema/typeDefs/` — API shape
- `server/src/schema/resolvers/` — API behavior
- `server/src/models/` — database
