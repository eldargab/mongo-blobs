var Writable = require('../lib/writable')
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

describe('writable', function () {
  var s, ds, log

  beforeEach(function () {
    log = Logger()
    ds = Downstream()
    s = new Writable
    s.on('drain', log.fn('drain'))
    s.on('error', function (err) {
      log('error:' + err.message)
    })
    s.on('close', log.fn('close'))
    s._write = function (data, cb) {
      data = data ? data.toString('utf8') : 'END'
      log('push:' + data)
      ds(cb)
    }
    s.chunkSize = 4
  })

  it('Should be writeable', function () {
    s.writable.should.be.true
  })

  describe('When it has less than one chunk buffered...', function () {
    it('.write() should return <true>', function () {
      s.write('a').should.be.true
    })
    it('nothing is pushed to downstream', function () {
      s.write('a')
      log.should.equal('')
    })
  })

  describe('When more than one chunk was buffered', function () {
    it('.write() should return <false>', function () {
      s.write('abcd').should.be.false
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
    it('Should make stream non-writable', function () {
      s.end()
      s.writable.should.be.false
    })
    it('Should support callback', function () {
      s.end('aaaabbb', log.fn('DONE'))
      ds.done()
      ds.done()
      ds.done()
      log.should.equal('push:aaaa push:bbb push:END DONE')
    })
  })

  describe('Non-writable stream', function () {
    it('Should reject all writes', function () {
      s.writable = false // hack - this is readonly
      s.write('a')
      log.should.equal('error:Stream is not writable')
    })
  })

  describe('On error', function () {
    it('Should emit error event', function (done) {
      s.write('aaaa')
      s.on('error', function (err) {
        err.message.should.equal('push')
        s.writable.should.be.false
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
      s.writable.should.be.false
    })
    it('Should emit close if destroyed before end of pushing', function () {
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

