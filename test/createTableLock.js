const path = require('path')
const chai = require('chai')
const delay = require('delay')
const { expect } = chai
chai.should()

const createTableLock = require('../src/createTableLock')

function tester(fn) {
  const { wrapLock } = createTableLock()

  let buffer = []
  function out(message) {
    buffer.push(message)
  }

  const f = wrapLock(fn(out))

  return {
    f,
    getBuffer: () => buffer
  }
}

describe('createTableLock', () => {
  it('works synchronously', async () => {
    const {f, getBuffer} = tester(out => async (table, a, b, c) => {
      out(`${table} - ${a} ${b} ${c}`)
    })

    await Promise.all([
      f('mytable', 1, 2, 4),
      f('mytable', 2, 4, 8)
    ])

    expect(getBuffer()).to.eql([
      "mytable - 1 2 4",
      "mytable - 2 4 8",
    ])
  })

  it('locks the table for given table names', async function() {
    // This test takes up to about 2 seconds to finish. Give it extra time.
    this.timeout(5000)

    const {f, getBuffer} = tester(out => async (table, a, b, c) => {
      out(`${table} - ${a} ${b} ${c} - before`)

      // Add some delay to exaggerate the potential for race conditions
      await delay(1000)

      if (table === 'mytable') {
        // we don't care about othertable's "after" message.
        out(`${table} - ${a} ${b} ${c} - after`)
      }
    })

    await Promise.all([
      f('mytable', 1, 2, 4),
      f('mytable', 2, 4, 8),
      f('othertable', 1, 2, 4),
    ])

    // There's an implicit assumption by this test that "othertable" is called after "mytable".
    // It's possible that this is not guaranteed behaviour by Node.js.
    expect(getBuffer()).to.eql([
      "mytable - 1 2 4 - before",
      "othertable - 1 2 4 - before",
      "mytable - 1 2 4 - after",
      "mytable - 2 4 8 - before",
      "mytable - 2 4 8 - after",
    ])
  })
})