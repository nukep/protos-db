const path = require('path')
const fs = require('fs-extra')
const chai = require('chai')
const { expect } = chai
chai.should()

const createRecordDb = require('../src/recordDb')

describe('recordDb', () => {
  let recordDb

  before(async () => {
    const recordDbPath = path.resolve(__dirname, 'testing-record-db')

    // Removes directory and contents if it exists
    await fs.remove(recordDbPath)

    console.log(`Blob DB path: ${recordDbPath}`)
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