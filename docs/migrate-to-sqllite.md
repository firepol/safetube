# Migrating from JSON Files to SQLite in SafeTube

This document explains the considerations, risks, and best practices for migrating SafeTube's data storage from JSON files to SQLite.

---

## Why Consider SQLite?

- **Centralized storage:** Easier to query and manage than many JSON files.
- **Atomic operations:** Reduces risk of partial writes or corruption.
- **Scalability:** Handles larger datasets and more complex queries.

---

## SQLite and Concurrent Writes

- **Multiple readers:** SQLite allows many concurrent readers.
- **Single writer:** Only one write operation can occur at a time. Writes are serialized.
- **Locking:** If multiple processes or threads try to write simultaneously, SQLite locks the database. Others wait or may get a "database is locked" error if not handled.

---

## Electron Context (SafeTube)

- **Main process:** Node.js backend.
- **Renderer processes:** Browser windows (UI).
- **Preload scripts:** Bridge between main and renderer.

**Best practice:**
- Use SQLite only from the main process.
- Expose DB operations to renderer via IPC (inter-process communication).
- Avoid direct DB access from multiple processes.

---

## Connection Pooling

- **Not needed for SQLite:**
    - SQLite is file-based, not a server DB.
    - Use a single connection per process.
    - If using a pool, keep all connections in the same process.

---

## Best Practices for SafeTube

1. **Single Writer Principle:**
   - Route all DB writes through the main process.
   - Renderer processes should use IPC for DB changes.
2. **Enable WAL Mode:**
   - [Write-Ahead Logging (WAL)](https://sqlite.org/wal.html) improves concurrency (readers can read during writes).
3. **Short Transactions:**
   - Keep write transactions brief to minimize lock time.
4. **Handle Lock Errors Gracefully:**
   - Implement retry logic for transient "database is locked" errors.

---

## Summary Table

| Scenario                                      | Safe?         | Notes                                      |
|------------------------------------------------|---------------|---------------------------------------------|
| Multiple readers (same process)                | ✅            | No problem                                  |
| Multiple writers (same process, one connection)| ✅            | Best practice                               |
| Multiple writers (same process, many conns)    | ⚠️            | Possible lock contention, but manageable    |
| Multiple writers (different processes)         | ⚠️/❌         | Risky, can cause lock errors/corruption     |
| Use WAL mode                                  | ✅            | Improves concurrency                        |

---

## Conclusion

- **SQLite is safe for SafeTube if you centralize writes in the main process and use WAL mode.**
- **Do not open the same SQLite file for writing from multiple processes.**
- Use IPC to funnel all DB operations through the main process in Electron.

---

## References

- [SQLite Concurrency docs](https://sqlite.org/faq.html#q5)
- [Electron + SQLite best practices](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md#electron)

---

If you need code examples or migration steps, ask a maintainer or open an issue.
