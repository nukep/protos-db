const { promisify } = require('util')
const fs = require('fs-extra')
const zlib = require('zlib')
const crypto = require('crypto')
const path = require('path')

// Data is a string
function digestSha1(data) {
  return crypto.createHash('sha1').update(data, 'utf8').digest().toString('hex')
}

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

function createBlobDb(blobsPath) {
  function getBlobPath(hash) {
    const first = hash.substring(0,2)
    const rest = hash.substring(2)
    return path.resolve(blobsPath, first, rest + '.gz')
  }

  // Data is a string
  // Returns the blob hash
  async function persistDataAsBlob(data) {
    const hash = digestSha1(data)
    const blobPath = getBlobPath(hash)

    if (!fileExists(blobPath)) {
      // Write if it doesn't exist
      const dirname = path.dirname(blobPath)
      await fs.ensureDir(dirname)

      const gzippedBuffer = await promisify(zlib.gzip)(data, "utf8")
      await fs.writeFile(blobPath, gzippedBuffer)
    }

    return hash
  }

  async function readBlobDataAsString(hash) {
    const blobPath = getBlobPath(hash)
    if (!fileExists(blobPath)) {
      throw new Error(`Blob ${hash} doesn't exist`)
    }
    const gzippedBuffer = await fs.readFile(blobPath)
    return (await promisify(zlib.gunzip)(gzippedBuffer)).toString("utf8")
  }

  return {persistDataAsBlob, readBlobDataAsString}
}

module.exports = createBlobDb