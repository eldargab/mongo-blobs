var Writeable = require('../lib/writeable')
var Logger = require('test-log')

function Downstream () {
  var cb

  function downstream (_cb) {
    if (cb) throw Error('Downstream was called before it pushed previous value')
    cb = _cb
  }

  downstream.hasPush = function () {
    return !!cb
  }

  downstream.done = function (err) {
    if (!downstream.hasPush()) throw new Error('Downstream dont have pushes')
    var _cb = cb; cb = null
    _cb(err)
  }

  return downstream
}

describe('Writeable', function () {
  var s, ds, log

  beforeEach(function () {
    log = Logger()
    ds = Downstream()
    s = new Writeable
    s.on('drain', log.fn('drain'))
    s.on('error', function (err) {
      log('error:' + err.message)
    })
    s._close = log.fn('close')
    s._write = function (data, cb) {
      data = data ? data.toString('utf8') : 'END'
      log('push:' + data)
      ds(cb)
    }
    s.chunkSize = 4
  })

  it('Should be writeable', function () {
    s.writeable.should.be.true
  })

  describe('When it has less than one chunk buffered...', function () {
    it('.write() should return false', function () {
      s.write('a').should.be.false
    })
    it('nothing is pushed to downstream', function () {
      s.write('a')
      log.should.equal('')
    })
  })

  describe('When more than one chunk was buffered', function () {
    it('.write() returns true', function () {
      s.write('abcd').should.be.true
    })
    it('Downstream recieves pushes', function () {
      s.write('abcdef')
      log.should.equal('push:abcd')
    })
  })

  it('Should never push before previous push was completed', function () {
    s.write('aaaa')
    s.write('bbbbcccc')
    log.should.equal('push:aaaa')
    ds.done()
    log.should.equal('push:aaaa push:bbbb')
  })

  it('Should emit drain event when it has less than one chunk buffered after completed push', function () {
    s.write('aaaabb')
    ds.done()
    log.should.equal('push:aaaa drain')
  })

  describe('.end()', function () {
    it('Should push all data available', function () {
      s.write('a')
      s.end('b')
      log.should.equal('push:ab')
    })
    it('Should make stream non-writeable', function () {
      s.end()
      s.writeable.should.be.false
    })
    it('Should close stream after end of pushing', function () {
      s.end('aaaabbb')
      ds.done()
      ds.done()
      ds.done()
      log.should.equal('push:aaaa push:bbb push:END close')
    })
  })

  describe('Non-writeable stream', function () {
    it('Should reject all writes', function () {
      s.writeable = false // hack - this is readonly
      s.write('a')
      log.should.equal('error:Stream is not writeable')
    })
  })

  describe('On error', function () {
    it('Should emit error event', function (done) {
      s.write('aaaa')
      s.on('error', function (err) {
        err.message.should.equal('push')
        s.writeable.should.be.false
        done()
      })
      ds.done(new Error('push'))
    })
    it('Should destroy itself', function () {
      s.write('aaaa')
      s.destroy = log.fn('destroy')
      ds.done(new Error('push'))
      log.should.equal('push:aaaa error:push destroy')
    })
  })

  describe('Destroyed stream', function () {
    it('Should be non-writeable', function () {
      s.destroy()
      s.writeable.should.be.false
    })
    it('Should be closed', function () {
      s.destroy()
      log.should.equal('close')
    })
    it('Should stop pushing (no drain event)', function () {
      s.write('aaaa')
      s.destroy()
      ds.done()
      log.should.equal('push:aaaa close')
    })
    it('Should not emit error events', function () {
      s.write('aaaa')
      s.destroy()
      ds.done(new Error)
      log.should.not.include('error')
    })
  })
})

