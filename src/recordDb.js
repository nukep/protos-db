const fs = require('fs-extra')
const path = require('path')
const moment = require('moment')
const createTableLock = require('./createTableLock')

function fileExists(path) {
  try {
    fs.accessSync(path)
    return true
  } catch (e) {
    if (e.code == 'ENOENT') {
      return false
    } else {
      throw e
    }
  }
}

function iso8601TimestampToIndex(iso8601Timestamp) {
  // It's YYYY-MM-DD, but always in UTC time.
  const out = moment.utc(iso8601Timestamp).format('YYYY-MM-DD')

  // Validate the output here - moment will output strings like "Invalid date" if the input's not valid.
  const m = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.exec(out)
  if (m == null) {
    throw new Error(`Date is not valid: got ${out}`)
  }
  return out
}

function iso8601TimestampLessThanOrEqual(a, b) {
  const diff = moment.utc(a).diff(moment.utc(b))
  return diff <= 0
}

// onAppend accepts an object with the fields "table" and "record".
// * onAppend :: ({ table, record })
function createRecordDb(recordPath, recordToTimestampFunction, { onAppend=null }={}) {
  function getTablePath(table) {
    return path.resolve(recordPath, table,)
  }

  function getRecordIndexPath(table, index) {
    return path.resolve(getTablePath(table), index + '.json')
  }

  async function readRecordIndex(table, index) {
    const recordIndexPath = getRecordIndexPath(table, index)
    if (fileExists(recordIndexPath)) {
      const json = await fs.readFile(recordIndexPath, "utf8")
      return JSON.parse(json)
    } else {
      return []
    }
  }

  async function writeRecordIndex(table, index, json) {
    const recordIndexPath = getRecordIndexPath(table, index)
    const s = JSON.stringify(json, null, 2)
    const dirname = path.dirname(recordIndexPath)
    await fs.ensureDir(dirname)
    await fs.writeFile(recordIndexPath, s, "utf8")
  }

  async function getTableIndexes(table) {
    const tablePath = getTablePath(table)
    if (fileExists(tablePath)) {
      const files = await fs.readdir(tablePath)
      return files.map(fileName => {
        const m = /^(.*)\.json$/.exec(fileName)
        if (m == null) return null
        return m[1]
      }).filter(x => x != null)
    } else {
      return []
    }
  }

  async function getTableNames() {
    if (!fileExists(recordPath)) {
      return []
    }
    const names = await fs.readdir(recordPath)
    return names
  }

  async function readLatestRecord(table) {
    const indexes = await getTableIndexes(table)

    const indexesToTryInOrder = indexes.sort().reverse()

    for (const index of indexesToTryInOrder) {
      const r = await readRecordIndex(table, index)
      if (r.length > 0) {
        return r[r.length-1]
      }
    }

    return null
  }

  async function readLatestRecordAsOf(table, asOfIso8601Timestamp) {
    const indexAsOf = iso8601TimestampToIndex(asOfIso8601Timestamp)

    const indexes = await getTableIndexes(table)

    const indexesToTryInOrder = indexes.sort().reverse().filter(x => iso8601TimestampLessThanOrEqual(x, indexAsOf))

    for (const index of indexesToTryInOrder) {
      const json = await readRecordIndex(table, index)
      const r = json.filter(x => iso8601TimestampLessThanOrEqual(recordToTimestampFunction(x), asOfIso8601Timestamp))
      if (r.length > 0) {
        return r[r.length-1]
      }
    }

    return null
  }

  async function appendRecordToTable(table, record) {
    const timestamp = recordToTimestampFunction(record)
    const index = iso8601TimestampToIndex(timestamp)
    const json = await readRecordIndex(table, index)
    json.push(record)
    if (onAppend) {
      onAppend({table, record})
    }
    await writeRecordIndex(table, index, json)
  }

  async function updateLatestRecord(table, updateFn) {
    const record = await readLatestRecord(table)
    const newRecord = updateFn(record)
    if (newRecord !== false) {
      await appendRecordToTable(table, newRecord)
    }
    return newRecord
  }

  // Returns a map of table name -> record
  // Note: This function locks tables!
  async function getLatestRecordOfAllTables() {
    const tableNames = await getTableNames()

    const latestRecords = {}

    await Promise.all(tableNames.map(async tableName => {
      const record = await (wrapLock(readLatestRecord))(tableName)
      latestRecords[tableName] = record
    }))

    return latestRecords
  }

  const { wrapLock } = createTableLock()

  return {
    getTableNames,
    getLatestRecordOfAllTables,
    readLatestRecord: wrapLock(readLatestRecord),
    readLatestRecordAsOf: wrapLock(readLatestRecordAsOf),
    appendRecordToTable: wrapLock(appendRecordToTable),
    updateLatestRecord: wrapLock(updateLatestRecord)
  }
}

module.exports = createRecordDb