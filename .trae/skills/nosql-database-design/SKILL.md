---
name: nosql-database-design
description: Standards for Mongoose schema design and MongoDB data modeling. Includes embedding vs referencing, indexing strategies, and query optimization using QueryBuilder and AggregationBuilder.
origin: Project
---

# NoSQL Database Design

## Table of Contents

- [Overview](#overview)
- [When to Use](#when-to-use)
- [Best Practices](#best-practices)
- [Query & Aggregation Builders](#query--aggregation-builders)

## Overview

Design scalable NoSQL schemas for MongoDB using Mongoose. Covers document structure, denormalization, indexing, and efficient querying in this project.

## When to Use

- Mongoose schema and model design
- Decision making: Embedding vs. referencing
- Designing compound or text indexes
- Planning complex aggregations or search queries

## Best Practices

### 1. Document Structure

- **Embedding**: Use for one-to-one or small one-to-many relationships (e.g., address, items in an order).
- **Referencing**: Use for large one-to-many or many-to-many relationships (e.g., users to orders, products to categories).
- **Embedded Sub-schemas**: Define sub-schemas without `_id` when they don't need independent identity (e.g., `_id: false`).

Refer to [codebase-blueprint.md](file:///.trae/templates/codebase-blueprint.md#L2) for Mongoose model and schema templates.

### 2. Indexing Strategies

- **Single Field Index**: Create on fields used in common queries (e.g., `email`, `userId`).
- **Compound Index**: Optimize queries using multiple fields (e.g., `userId: 1, createdAt: -1`).
- **Text Index**: Use for fuzzy searching on name, title, or description fields.
- **Mongoose Metrics**: Always review query execution stats via the built-in observability system.

### 3. Naming Conventions

- **Collections**: Plural, lowercase (e.g., `users`, `orders`).
- **Fields**: camelCase (e.g., `firstName`, `createdAt`).
- **Models**: PascalCase, singular (e.g., `User`, `Order`).

### 4. Documentation Standard (MANDATORY)

Every database structural change (schema update, new model, relationship change) MUST be reflected in `ux-flow-with-api-responses/database-design.md`.

- **Style**: Use Banglish for narrative explanations.
- **ER Diagram**: Update the Mermaid diagram if relationships change.
- **Tables**: Update field tables with `Required (✅)` or `Optional (❌)` marks.
- **Enums**: Document state/status changes (e.g., `USER_STATUS`).

## Query & Aggregation Builders

This project uses custom builders to handle search, filter, sort, and pagination metadata.

### 1. QueryBuilder (`src/app/builder/QueryBuilder.ts`)

Use for standard list queries with search and filter:

```typescript
const query = new QueryBuilder(Model.find(), req.query)
  .search(['name', 'email'])
  .filter()
  .sort()
  .paginate()
  .fields();

const data = await query.modelQuery;
const pagination = await query.getPaginationInfo();
```

### 2. AggregationBuilder (`src/app/builder/AggregationBuilder.ts`)

Use for complex joins and multi-stage transformations:

```typescript
const query = new AggregationBuilder(Model.aggregate())
  .match(baseFilter)
  .lookup({ from: 'users', localField: 'userId', foreignField: '_id', as: 'user' })
  .unwind('$user')
  .paginate(req.query);

const result = await query.execute();
```

Refer to [architecture.md](file:///.claude/rules/architecture.md#L33) for detailed usage of builders.
