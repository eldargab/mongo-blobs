var Stream = require('stream')
var ChunksQueue = require('./chunks-queue')

module.exports = Writable

Writable.prototype = Object.create(Stream.prototype)

function Writable () {
  Stream.call(this)
  this._isEnded = false
  this._destroyed = false
  this.writable = true
}

Writable.prototype = Object.create(Stream.prototype)

Writable.prototype.chunkSize = 15 * 1024

Writable.prototype._write = function (cb) {
  cb(new Error('._write() is not implemented'))
}

Writable.prototype.write = function (data, encoding) {
  if (!this.writable) {
    this.emit('error', new Error('Stream is not writable'))
    return
  }

  if (!Buffer.isBuffer(data)) {
    data = new Buffer(data, encoding || 'utf8')
  }

  this._queue = this._queue || new ChunksQueue(this.chunkSize)

  var flushNeeded = this._queue.write(data)

  if (flushNeeded)
    this._flush()

  return !flushNeeded || !this._flushIsRunning // for the case of sync flush
}

Writable.prototype.end = function (data, encoding, cb) {
  this._isEnded = true
  if (typeof data == 'function') {
    cb = data
  } else if (typeof encoding == 'function') {
    cb = encoding
    this.write(data)
  } else if (data) {
    this.write(data, encoding)
  }
  cb && this.on('_end', cb)
  this.writable = false
  this._flush()
  return this
}

Writable.prototype.destroy = function () {
  if (this._destroyed) return
  this.writable = false
  this._destroyed = true
  this._queue = null
  if (!this._didOnEnd) this.emit('close')
}

Writable.prototype.destroySoon = Writable.prototype.end

Writable.prototype._flush = function () {
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

  s._write(chunk, function (err) {
    if (s._destroyed) return
    if (err) {
      s.writable = false
      s.emit('error', err)
      s.destroy()
      return
    }
    if (noChunk) {
      s._didOnEnd = true
      s.destroy()
      s.emit('_end')
      return
    }
    flush(s)
  })
}
