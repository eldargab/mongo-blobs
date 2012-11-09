var Stream = require('stream')
var ChunksQueue = require('./chunks-queue')

module.exports = Writeable

Writeable.prototype = Object.create(Stream.prototype)

function Writeable () {
  Stream.call(this)
  this._isEnded = false
  this._destroyed = false
  this.writeable = true
}

Writeable.prototype = Object.create(Stream.prototype)

Writeable.prototype.chunkSize = 15 * 1024

Writeable.prototype._close = function () {
  this.emit('close')
}

Writeable.prototype._write = function (cb) {
  cb(new Error('._write() is not implemented'))
}

Writeable.prototype.write = function (data, encoding) {
  if (!this.writeable) {
    this.emit('error', new Error('Stream is not writeable'))
    return
  }

  if (!Buffer.isBuffer(data)) {
    data = new Buffer(data, encoding || 'utf8')
  }

  this._queue = this._queue || new ChunksQueue(this.chunkSize)

  var flushNeeded = this._queue.write(data)

  if (flushNeeded)
    this._flush()

  return flushNeeded || !!this._flushIsRunning // for the case of sync flush
}

Writeable.prototype.end = function (data, encoding) {
  this._isEnded = true
  if (data) this.write(data, encoding)
  this.writeable = false
  this._flush()
  return this
}

Writeable.prototype.destroy = function () {
  if (this._destroyed) return
  this.writeable = false
  this._destroyed = true
  this._queue = null
  this._close()
}

Writeable.prototype.error = function (err) {
  this.writeable = false
  this.emit('error', err)
  this.destroy()
}

Writeable.prototype.destroySoon = Writeable.prototype.destroy

Writeable.prototype._flush = function () {
  if (this._flushIsRunning) return
  flush(this)
}

function flush (s) {
  if (s._destroyed) return
  s._flushIsRunning = true

  var chunk = s._queue && s._queue.pull(s._isEnded)
  var noChunk = !chunk

  if (noChunk && !s._isEnded) {
    s._flushIsRunning = false
    s.emit('drain')
    return
  }

  s._write(chunk, function (error) {
    if (s._destroyed) return
    if (error) return s.error(error)
    noChunk ? s.destroy() : flush(s)
  })
}
