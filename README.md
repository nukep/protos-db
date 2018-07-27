# What's this?

This is a filesystem-based database I quickly wrote to assist with iterative prototyping. This is intended as a holdover for projects that don't yet implement a "real" database.

## Immutable, addressible data is stored as "Blobs"

Each blob is a gzip-compressed string that's addressable by its SHA1 hash.

Why on earth would you want this?

a) To avoid persisting the same data twice - save on hard drive space. This is desirable for sparse-yet-large data that you want to normalize.
b) To compress file contents that contain lots of repetition, such as JSON.

Usage:

```js
const { createBlobDb } = require('protos-db')

const blobDb = createBlobDb('./path/to/my-blob-db')

blobDb.persistDataAsBlob("Hello World!").then(hash => {
  console.log(`Persisted Hash: ${hash}`)
})
// => Prints "Persisted Hash: 2ef7bde608ce5404e97d5f042f95f89f1c232871"

// later on in your program...

blobDb.readBlobDataAsString("2ef7bde608ce5404e97d5f042f95f89f1c232871").then(contents => {
  console.log(`Contents: ${contents}`)
})
// => Prints "Contents: Hello World!"

```


## Blob data structure, tree

A blob directory might look something like this:

```
my-blob-db
├── 2a
│   └── ae6c35c94fcfb415dbe95f408b9ce91ee846ed.gz
├── 87
│   └── 2e18a933e6c41dc5abe6c29a38b58959c8112b.gz
└── b8
    └── dfb080bc33fb564249e34252bf143d88fc018f.gz
```

The database above contains three blobs:
* `2aae6c35c94fcfb415dbe95f408b9ce91ee846ed`
* `872e18a933e6c41dc5abe6c29a38b58959c8112b`
* `b8dfb080bc33fb564249e34252bf143d88fc018f`

If you read the blob, you get a string:

```
$ zcat my-blob-db/2a/ae6c35c94fcfb415dbe95f408b9ce91ee846ed.gz
hello world
$
```

If you rehash the uncompressed string, you get the directory+filename back:

```
$ zcat my-blob-db/2a/ae6c35c94fcfb415dbe95f408b9ce91ee846ed.gz | sha1sum
2aae6c35c94fcfb415dbe95f408b9ce91ee846ed  -
$
```

Notice how the first two characters of the SHA1 are used for the directory names.
This is inspired by Git and CDNs that do the same.

* The first reason is for performance. Many file systems, such as Ext*, scan files in a directory linearly. I.e. they start from the top, and check one-by-one until a match is found.
* The second reason for doing this is to stay within the file system's file limit for directories. On Ext3, this is about 32,000.
* The last reason is for humans. If you're troubleshooting the database, you don't want to `ls` the directory and get spammed with tens of thousands of files up-front. By fanning out to 256 buckets, that 10,000 becomes 39.


## Append-only data is stored as records in tables

All records are indexed by calendar day.

