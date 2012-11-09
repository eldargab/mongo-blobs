module.exports = ChunksQueue

function ChunksQueue (chunkSize) {
  this.chunkSize = chunkSize
  this.chunks = []
}

ChunksQueue.prototype.pull = function (alsoNotFull) {
  var chunk = this.chunks[0]
  if (!chunk) return
  if (alsoNotFull) return this.chunks.shift().data()
  if (!chunk.isFull()) return
  return this.chunks.shift().data()
}

ChunksQueue.prototype.write = function (buffer) {
  do {
    if (!this._chunk || this._chunk.isFull()) {
      this._chunk = new Chunk(this.chunkSize)
      this.chunks.push(this._chunk)
    }

    var bytesWrited = this._chunk.write(buffer)

    if (bytesWrited == buffer.length)
      return this._chunk.isFull() || this.chunks.length > 1

    buffer = buffer.slice(bytesWrited)
    this._chunk = null
  } while (true)
}

function Chunk (size) {
  this.size = size
  this._buffer = new Buffer(this.size)
  this.length = 0
}

Chunk.prototype.isFull = function () {
  return this.size == this.length
}

Chunk.prototype.data = function () {
  return this._buffer.slice(0, this.length)
}

Chunk.prototype.write = function (data) {
  var bytesToWrite = Math.min(
    data.length,
    this.size - this.length
  )
  data.copy(this._buffer, this.length, 0, bytesToWrite)
  this.length += bytesToWrite
  return bytesToWrite
}
