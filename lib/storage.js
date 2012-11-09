var Readable = require('./readable')
var Writeable = require('./writeable')

module.exports = Storage

function Storage (db, prefix) {
  if (!(this instanceof Storage)) {
    return new Storage(db, prefix)
  }
  this.db = db
  this.skin = db.driver
  this.prefix = prefix || 'fs'
  this.files = this.db.get(this.prefix + '.files')
  this.chunks = this.db.get(this.prefix + '.chunks')
  this.chunks.index({files_id: 1, n: 1}).error(function (err) {
    console.warn(err)
  })
}

Storage.prototype.find = function () {
  return this.files.find.apply(this.files, arguments)
}

Storage.prototype.findOne = function () {
  return this.files.findOne.apply(this.fils, arguments)
}


Storage.prototype.chunkSize = 256 * 1024


Storage.prototype.createWriteStream = function (file) {
  file = file || {}
  file._id = this.files.id()
  file.uploadDate = new Date
  file.chunkSize = file.chunkSize || this.chunkSize
  file.length = 0
  file._dirty = true
  return new Upload(file, this)
}

function Upload (file, storage) {
  Writeable.call(this)
  this.file = file
  this.chunkSize = file.chunkSize
  this.skin = storage.skin
  this.files = storage.files
  this.chunks = storage.chunks
  this.prefix = storage.prefix
  this.chunk = 0
}

Upload.prototype = Object.create(Writeable.prototype)

Upload.prototype._write = function (data, cb) {
  if (data) {
    this.putHead(function (err) {
      if (err) return cb(err)
      this.file.length += data.length
      this.putChunk(data, cb)
    }.bind(this))
  } else {
    this.md5(function (err) {
      if (err) return cb(err)
      delete this.file._dirty
      this.saveHead(cb)
    }.bind(this))
  }
}

Upload.prototype.putHead = function (cb) {
  if (this.headPuted) return cb()
  this.saveHead(function (err) {
    if (err) return cb(err)
    this.headPuted = true
    cb()
  }.bind(this))
}

Upload.prototype.saveHead = function (cb) {
  this.files.update(this.file._id, this.file, {upsert: true}, cb)
}

Upload.prototype.putChunk = function (data, cb) {
  this.chunks.insert({
    files_id: this.files.id(this.file._id),
    n: this.chunk++,
    data: this.skin.bson_serializer.Binary(data)
  }, cb)
}

Upload.prototype.md5 = function (cb) {
  this.skin.command({
    filemd5: this.file._id,
    root: this.prefix
  }, function (err, res) {
    if (err) return cb(err)
    this.file.md5 = res.md5
    cb()
  }.bind(this))
}


Storage.prototype.createReadStream = function (id) {
  id = id._id || id
  var stream = new Download(id, this)
  process.nextTick(function () {
    stream.start()
  })
  return stream
}

function Download (id, storage) {
  Readable.call(this)
  this.id = id
  this.storage = storage
}

Download.prototype = Object.create(Readable.prototype)

Download.prototype.head = function (cb) {
  if (this.file) return cb(null, this.file)
  this.storage.files.findById(this.id, function (err, file) {
    if (err) return cb(err)
    if (!file) return cb(new Error('Blob ' + this.id + ' not found'))
    this.file = file
    cb(null, file)
  }.bind(this))
}

Download.prototype.cursor = function () {
  return this._cursor
    ? this._cursor
    : this._cursor = this.storage.chunks.col.find({
      files_id: this.storage.chunks.id(this.id)
    }).sort('n')
}

Download.prototype._read = function (cb) {
  this.head(function (err, file) {
    if (err) return cb(err)
    var cursor = this.cursor()
    cursor.nextObject(function (err, chunk) {
      if (err) return cb(err)
      if (!chunk) return cb()
      var data = new Buffer(chunk.data.read(0), 'binary')
      cb(null, data)
    })
  }.bind(this))
}
