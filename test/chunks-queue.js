var should = require('should')
var ChunksQueue = require('../lib/chunks-queue')

describe('ChunksQueue', function () {
  var q

  beforeEach(function () {
    q = new ChunksQueue(4)
    var _write = q.write
    q.write = function (string) {
      return _write.call(this, new Buffer(string, 'ascii'))
    }

    var _pull = q.pull
    q.pull = function (alsoNotFull) {
      var chunk = _pull.call(this, alsoNotFull)
      if (chunk) chunk = chunk.toString('ascii')
      return chunk
    }
  })

  it('.write() returns "true" if more then one chunk were collected, otherwise returns "false"', function () {
    q.write('a').should.be.false
    q.write('a').should.be.false
    q.write('aa').should.be.true // one full chunk
    q.write('a').should.be.true
  })

  it('.pull() pulls one collected chunk from queue, if there is no full chunks it returns "undefined"', function () {
    q.write('aaaabbbbcc') // chunks aaaa, bbbb, cc
    q.pull().should.equal('aaaa')
    q.pull().should.equal('bbbb')
    should.ok(q.pull() === undefined)
  })

  it('.pull(true) pulls even non-full chunks and returns "undefined" only if there is no chunks available', function () {
    q.write('aa')
    q.pull(true).should.equal('aa')
    should.ok(q.pull(true) === undefined)
  })
})

