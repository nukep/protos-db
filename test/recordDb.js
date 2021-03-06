const path = require('path')
const fs = require('fs-extra')
const chai = require('chai')
const { expect } = chai
chai.should()

const createRecordDb = require('../src/recordDb')

describe('recordDb (no tables)', () => {
  let recordDb

  before(async () => {
    const recordDbPath = path.resolve(__dirname, 'testing-record-db-empty')

    // Removes directory and contents if it exists
    await fs.remove(recordDbPath)

    console.log(`Record DB path: ${recordDbPath}`)
    recordDb = createRecordDb(recordDbPath, record => record.timestamp)
  })

  it('getTableNames', async () => {
    const names = await recordDb.getTableNames()

    expect(names).to.eql([])
  })

  it('reads null as latest record of nonexistent table', async () => {
    const record = await recordDb.readLatestRecord('nonexistent')

    expect(record).to.be.null
  })
})

describe('recordDb (getLatestRecordOfAllTables)', () => {
  let recordDb

  before(async () => {
    const recordDbPath = path.resolve(__dirname, 'testing-record-db-getLatestRecordOfAllTables')

    // Removes directory and contents if it exists
    await fs.remove(recordDbPath)

    console.log(`Record DB path: ${recordDbPath}`)
    recordDb = createRecordDb(recordDbPath, record => record.timestamp)
    await recordDb.appendRecordToTable('sampleTable', {
      timestamp: "2018-06-15T00:11:06Z",
      test: "789"
    })
    await recordDb.appendRecordToTable('sampleTable', {
      timestamp: "2018-06-16T00:11:06Z",
      test: "123"
    })
    await recordDb.appendRecordToTable('sampleTable2', {
      timestamp: "2018-11-08T00:11:06Z",
      foo: "bar"
    })
  })

  it('works', async () => {
    const tableRecords = await recordDb.getLatestRecordOfAllTables()
    expect(tableRecords).to.eql({
      sampleTable:  { timestamp: '2018-06-16T00:11:06Z', test: '123' },
      sampleTable2: { timestamp: '2018-11-08T00:11:06Z', foo: 'bar' }
    })
  })
})

describe('recordDb (onAppend)', () => {
  let recordDb
  let onAppendCalls

  before(async () => {
    const recordDbPath = path.resolve(__dirname, 'testing-record-db-onappend')

    // Removes directory and contents if it exists
    await fs.remove(recordDbPath)

    onAppend = (record) => {
      onAppendCalls.push(record)
    }

    console.log(`Record DB path: ${recordDbPath}`)
    recordDb = createRecordDb(recordDbPath, record => record.timestamp, {
      onAppend
    })
  })

  beforeEach(() => {
    onAppendCalls = []
  })

  it('notifies on appendRecordToTable', async () => {
    await recordDb.appendRecordToTable('myTable', {
      timestamp: "2018-06-15T00:11:06Z",
      test: "123"
    })
    expect(onAppendCalls).to.eql([{
      table: "myTable",
      record: {
        timestamp: "2018-06-15T00:11:06Z",
        test: "123"
      }
    }])
  })

  it('notifies on updateLatestRecord', async () => {
    await recordDb.updateLatestRecord('myTable2', (record) => {
      return {
        timestamp: "2018-06-15T00:11:06Z",
        test: "456"
      }
    })
    // A second update to make sure onAppend notifies with the final record
    await recordDb.updateLatestRecord('myTable2', (record) => {
      return {
        ...record,
        timestamp: "2018-06-16T00:11:06Z",
      }
    })

    expect(onAppendCalls).to.eql([{
      table: "myTable2",
      record: {
        timestamp: "2018-06-15T00:11:06Z",
        test: "456"
      }
    }, {
      table: "myTable2",
      record: {
        timestamp: "2018-06-16T00:11:06Z",
        test: "456"
      }
    }])
  })

  it('does not notify on updateLatestRecord when it returns false', async () => {
    await recordDb.updateLatestRecord('myTable', (record) => false)
    expect(onAppendCalls).to.eql([])
  })
})

describe('recordDb', () => {
  let recordDb

  before(async () => {
    const recordDbPath = path.resolve(__dirname, 'testing-record-db')

    // Removes directory and contents if it exists
    await fs.remove(recordDbPath)

    console.log(`Record DB path: ${recordDbPath}`)
    recordDb = createRecordDb(recordDbPath, record => record.timestamp)

    await recordDb.appendRecordToTable('sampleTable', {
      timestamp: "2018-06-15T00:11:06Z",
      test: "789"
    })
    await recordDb.appendRecordToTable('sampleTable', {
      timestamp: "2018-07-01T10:01:00Z",
      test: "012"
    })
    await recordDb.appendRecordToTable('sampleTable', {
      timestamp: "2018-07-01T12:34:56Z",
      test: "123-1"
    })
    await recordDb.appendRecordToTable('sampleTable', {
      timestamp: "2018-07-01T12:34:56Z",
      test: "123-2"
    })
    await recordDb.appendRecordToTable('sampleTable', {
      timestamp: "2018-07-01T12:34:57Z",
      test: "456"
    })
  })

  it('getTableNames', async () => {
    const names = await recordDb.getTableNames()

    expect(names).to.eql(['sampleTable'])
  })

  it('reads null as latest record of nonexistent table', async () => {
    const record = await recordDb.readLatestRecord('nonexistent')

    expect(record).to.be.null
  })

  it('appends record to table', async () => {
    await recordDb.appendRecordToTable('table1', {
      timestamp: "2018-07-01T12:34:56Z",
      test: "123"
    })

    const record = await recordDb.readLatestRecord('table1')
    record.should.eql({
      timestamp: "2018-07-01T12:34:56Z",
      test: "123"
    })
  })

  it('fails to append record if timestamp\'s invalid', async () => {
    try {
      // Timestamp's invalid because June doesn't have a 31st day
      await recordDb.appendRecordToTable('invalid-timestamp-table', {
        timestamp: "2018-06-31T00:11:06Z",
        message: "Hello"
      })
    } catch (e) {
      e.message.should.contain("Date is not valid: got")
      return
    }
    throw new Error("Should have thrown an exception")
  })


  it('updateLatestRecord updates latest record', async () => {
    await recordDb.appendRecordToTable('table2', {
      timestamp: "2018-07-01T12:34:56Z",
      test: "123"
    })
    const result = await recordDb.updateLatestRecord('table2', (record) => {
      return {
        ...record,
        timestamp: "2018-07-04T12:34:57Z",
      }
    })

    result.should.eql({
      timestamp: "2018-07-04T12:34:57Z",
      test: "123"
    })

    const record = await recordDb.readLatestRecord('table2')
    record.should.eql({
      timestamp: "2018-07-04T12:34:57Z",
      test: "123"
    })
  })

  it('updateLatestRecord still works when no records exist', async () => {
    const result = await recordDb.updateLatestRecord('table3', (record) => {
      expect(record).to.eql(null)

      return {
        timestamp: "2018-07-04T12:34:57Z",
      }
    })

    result.should.eql({
      timestamp: "2018-07-04T12:34:57Z"
    })

    const record = await recordDb.readLatestRecord('table3')
    record.should.eql({
      timestamp: "2018-07-04T12:34:57Z",
    })
  })

  it('updateLatestRecord doesn\'t update when result is false', async () => {
    await recordDb.appendRecordToTable('table4', {
      timestamp: "2018-07-01T12:34:56Z",
      test: "123"
    })
    const result = await recordDb.updateLatestRecord('table4', (record) => {
      return false
    })

    result.should.eql(false)

    const record = await recordDb.readLatestRecord('table4')
    record.should.eql({
      timestamp: "2018-07-01T12:34:56Z",
      test: "123"
    })
  })

  it('readLatestRecord gets the latest', async () => {
    const record = await recordDb.readLatestRecord('sampleTable')
    record.should.eql({
      timestamp: "2018-07-01T12:34:57Z",
      test: "456"
    })
  })

  it('readLatestRecordAsOf works on timestamp between records', async () => {
    const record = await recordDb.readLatestRecordAsOf('sampleTable', '2018-06-30T00:00:00Z')
    record.should.eql({
      timestamp: "2018-06-15T00:11:06Z",
      test: "789"
    })
  })

  it('readLatestRecordAsOf works on timestamp at record, prefers latest record at tied timestmap', async () => {
    const record = await recordDb.readLatestRecordAsOf('sampleTable', '2018-07-01T12:34:56Z')
    record.should.eql({
      timestamp: "2018-07-01T12:34:56Z",
      test: "123-2"
    })
  })

  it('readLatestRecordAsOf returns null if nothing before timestamp', async () => {
    const record = await recordDb.readLatestRecordAsOf('sampleTable', '2018-01-01T00:00:00Z')
    expect(record).to.be.null
  })
})