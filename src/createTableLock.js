const AsyncLock = require('async-lock')

function createTableLock() {
  // Lock the table for up to 30 seconds - should be more than ample.
  // If not, we've got problems.
  const lock = new AsyncLock({ timeout: 30000 })

  // Locks the table's lock before calling the function.
  // Assumes the first argument is the table name.
  // Locking is implemented with promises.
  function wrapLock(fn) {
    return async (table, ...args) => {
      return await lock.acquire(table, async () => {
        return await fn(table, ...args)
      })
    }
  }

  return { wrapLock }
}

module.exports = createTableLock