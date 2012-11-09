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
        .end('aaaabbbbcc')
        .on('close', function () {
          this.file.length.should.equal(10)
          this.file.md5.should.equal(md5('aaaabbbbcc'))
          this.file.hello.should.equal('world')
          done()
        })
    })
  })

  describe('Downloads', function () {
    var blob

    before(function (done) {
      storage.createWriteStream({chunkSize: 4})
        .end('aaaabbbbxx')
        .on('error', done)
        .on('close', function () {
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
  })
})
