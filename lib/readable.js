var Stream = require('stream')
var StringDecoder // load lazily

module.exports = Readable

Readable.prototype = Object.create(Stream.prototype)

function Readable () {
  Stream.call(this)
  this.readable = true
  this.paused = false
  this._started = false
  this._readInProgress = false
}

Readable.prototype = Object.create(Stream.prototype)

Readable.prototype._read = function (cb) {
  cb(new Error('._read() is not implemented'))
}

Readable.prototype.setEncoding = function (encoding) {
  StringDecoder || (StringDecoder = require('string_decoder').StringDecoder)
  this._decoder = new StringDecoder(encoding)
  return this
}

Readable.prototype._push = function (data) {
  data = this._decoder ? this._decoder.write(data) : data
  this.emit('data', data)
}

Readable.prototype.destroy = function () {
  this.readable = false
}

Readable.prototype.pause = function () {
  this.paused = true
}

Readable.prototype.resume = function () {
  if (!this.readable) return
  this.paused = false
  if (this._buffer) {
    this._push(this._buffer)
    this._buffer = null
  }
  this._startReading()
  return this
}

Readable.prototype.start = function () {
  if (this._started) return
  this._started = true
  this._startReading()
  return this
}

Readable.prototype._startReading = function () {
  var s = this
  if (s.paused || !s.readable || s.readInProgress) return
  s._readInProgress = true
  s._read(function (err, data) {
    s._readInProgress = false
    if (!s.readable) return
    if (err) {
      s.readable = false
      s.emit('error', err)
      s.emit('close')
      return
    }
    if (!data) {
      s.readable = false
      s.emit('end')
      return
    }
    if (s.paused) {
      s._buffer = data
      return
    }
    s._push(data)
    s._startReading()
  })
}
