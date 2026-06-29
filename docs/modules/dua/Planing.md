# Dua Module Development Plan

## 1. Requirements
- Admins can add and manage duas.
- Duas must have a title, waqt, details, and an audio file.
- Users can view duas filtered by prayer time.
- Users can search duas by title or details.

## 2. Technical Decisions
- **Model**: `Dua` collection with `isDeleted` for soft deletion.
- **Audio Handling**: Use `fileHandler` middleware for local/cloud storage.
- **Filtering**: Use `QueryBuilder` for `waqt` filtering and text search.
- **Roles**: 
  - Admin/Super Admin: Full CRUD.
  - Public/User: Read-only access.

## 3. Implementation Checklist
- [x] Define `IDua` interface.
- [x] Create Mongoose model with text index.
- [x] Implement Zod validation schemas.
- [x] Create `DuaService` with CRUD logic.
- [x] Create `DuaController` with `catchAsync`.
- [x] Define routes with `auth` and `fileHandler`.
- [x] Register routes in main router.
- [x] Document APIs and database design.

## 4. Edge Cases
- **Duplicate Uploads**: `fileHandler` handles unique naming.
- **Invalid Waqt**: Enforced by Zod and Mongoose enum.
- **Soft Delete**: Ensure `getAll` and `getSingle` filter out `isDeleted: true`.
