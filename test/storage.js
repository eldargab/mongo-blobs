var Storage = require('../lib/storage')
var monk = require('monk')
var should = require('should')

function md5 (str) {
  var hash = require('crypto').createHash('md5')
  hash.update(new Buffer(str, 'utf8'))
  return hash.digest('hex')
}

describe('Storage', function () {
  var storage, db

  before(function (done) {
    db = monk('localhost/test')
    storage = Storage(db)
    db.driver.dropDatabase(done)
  })

  describe('Uploads', function () {
    it('Should support streaming', function (done) {
      storage.createWriteStream({chunkSize: 4, hello: 'world'})
        .end('aaaabbbbcc', function () {
          this.file.length.should.equal(10)
          this.file.md5.should.equal(md5('aaaabbbbcc'))
          this.file.hello.should.equal('world')
          done()
        })
    })
  })

  describe('Download stream', function () {
    var blob

    before(function (done) {
      storage.createWriteStream({chunkSize: 4})
        .on('error', done)
        .end('aaaabbbbxx', function () {
          blob = this.file
          done()
        })
    })

    it('Should support streaming', function (done) {
      var str = ''
      storage.createReadStream(blob)
        .setEncoding('utf8')
        .on('data', function (data) {
          str += data
        })
        .on('end', function () {
          str.should.equal('aaaabbbbxx')
          this.file.should.eql(blob)
          done()
        })
    })

    it('Should support "head" event', function (done) {
      storage.createReadStream(blob._id)
        .on('head', function (head) {
          head.should.eql(blob)
          done()
        })
    })

    it('Should destroy itself right', function (done) {
      storage.createReadStream(blob)
        .on('data', function () {
          this.destroy()
          this.destroy() // multiple destroyes are ok
          this.readable.should.be.false
          done()
        })
        .on('error', done)
        .on('end', done)
    })
  })
})
