const path = require('path')
const fs = require('fs-extra')
const chai = require('chai')
chai.should()

const createBlobDb = require('../src/blobDb')

describe('blobDb', () => {
  let blobDb

  before(async () => {
    const blobDbPath = path.resolve(__dirname, 'testing-blob-db')

    // Removes directory and contents if it exists
    await fs.remove(blobDbPath)

    console.log(`Blob DB path: ${blobDbPath}`)
    blobDb = createBlobDb(blobDbPath)
  })

  it('write and reads the same data', async () => {
    const hash1 = await blobDb.persistDataAsBlob('hello world')
    const actualContents = await blobDb.readBlobDataAsString(hash1)
    actualContents.should.equal('hello world')
  })

  it('creates the same hash for identical contents', async () => {
    const hash1 = await blobDb.persistDataAsBlob('testing 123')
    const hash2 = await blobDb.persistDataAsBlob('testing 12345')
    const hash3 = await blobDb.persistDataAsBlob('testing 123')

    hash1.should.equal(hash3)
    hash2.should.not.equal(hash1)
  })

  it('throws an error if blob at hash doesn\'t exist', async () => {
    try {
      // hash is the sha1sum of "this hash doesn't exist"
      const hash1 = await blobDb.readBlobDataAsString('4331da668340f24ec7bf7e9fb934ce3ff1497f1b')
    } catch (e) {
      e.message.should.contain('Blob 4331da668340f24ec7bf7e9fb934ce3ff1497f1b doesn\'t exist')
      return
    }
    throw new Error("Should have thrown an exception")
  })
})