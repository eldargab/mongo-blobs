var Readable = require('../lib/readable')
var Logger = require('test-log')

function Upstream () {
  var cb, index = 0

  function upstream (_cb) {
    if (cb) throw Error('Upstream was called before it responded to previous request')
    cb = _cb
  }

  upstream.pulled = function () {
    return !!cb
  }

  upstream.done = function () {
    if (!upstream.pulled()) throw new Error('Upstream was not pulled')
    var val = upstream.values[index++]
    var _cb = cb; cb = null
    val instanceof Error ? _cb(val) : _cb(null, val)
  }

  upstream.values = []
  return upstream
}

describe('Readable', function () {
  var s, log

  beforeEach(function () {
    log = Logger()

    s = new Readable()
    s.setEncoding('utf8')
    s._read = Upstream()
    s._read.values = ['a', 'b']

    s.on('data', function (data) {
      log('data:' + data)
    })
    s.on('end', log.fn('end'))
    s.on('close', log.fn('close'))
    s.on('error', function (err) {
      log('error:' + err.message)
    })

    s.start()
  })

  it('Emits "data" event', function () {
    log.should.equal('')
    s._read.done()
    log.should.equal('data:a')
  })

  it('Emits "end" event when there is no more data to read', function () {
    s._read.done()
    s._read.done()
    s._read.done()
    log.should.equal('data:a data:b end')
  })

  describe('On error', function () {
    beforeEach(function () {
      s._read.values = [new Error('a')]
    })

    it('Should emit error and close events', function () {
      s._read.done()
      log.should.equal('error:a close')
    })

    it('Should become non-readable', function (done) {
      s.on('error', function () {
        s.readable.should.be.false
        done()
      })
      s._read.done()
    })

    it('Should not request for further values', function () {
      s._read.done()
      s._read.pulled().should.be.false
    })
  })

  describe('When paused', function () {
    it('Should stop emiting of data event and upstream pulling', function () {
      s.pause()
      s._read.done()
      log.should.equal('')
      s._read.pulled().should.be.false
    })
  })

  describe('When resumed', function () {
    it('Should continue emiting of data event and pulling', function () {
      s.pause()
      s._read.done()
      s.resume()
      log.should.equal('data:a')
      s._read.pulled().should.be.true
    })
  })

  describe('When destroyed', function () {
    it('Should become non-readable', function () {
      s.destroy()
      s.readable.should.be.false
    })
    it('Should not emit events anymore', function () {
      s.destroy()
      s._read.done()
      log.should.equal('')
    })
    it('Should stop upstream pulling', function () {
      s.destroy()
      s._read.done()
      s._read.pulled().should.be.false
    })
  })
})
