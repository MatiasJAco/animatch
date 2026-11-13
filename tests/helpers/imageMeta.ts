/**
 * A dependency-free image header reader.
 *
 * The suite must assert real image facts — dimensions and transparency — without
 * adding an image library to the project's dependency surface (research R-011,
 * Constitution VI). Everything needed lives in the container headers:
 *
 * - WebP: the `VP8X` chunk carries the canvas size and the alpha flag, `VP8L` carries
 *   the lossless size and its own alpha bit, `VP8 ` carries the lossy frame size, and
 *   an `ALPH` chunk marks an alpha channel.
 * - PNG: the `IHDR` chunk carries the size, and the colour type marks transparency.
 * - JPEG: the `SOF` frame header carries the size.
 */

export interface ImageMeta {
  width: number
  height: number
  alpha: boolean
}

const RIFF = 0x52494646 // "RIFF"
const WEBP = 0x57454250 // "WEBP"

// The WebP VP8X flag bits, as libwebp defines them.
const VP8X_ALPHA_FLAG = 0x10

export function readImageMeta(bytes: Uint8Array): ImageMeta {
  if (bytes.length < 8) {
    throw new Error('the file is too short to be an image')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  if (view.getUint32(0, false) === RIFF && view.getUint32(8, false) === WEBP) {
    return readWebP(bytes, view)
  }
  if (isPng(bytes)) {
    return readPng(bytes, view)
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return readJpeg(bytes, view)
  }
  throw new Error('unrecognised image container')
}

export function isPng(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return signature.every((value, index) => bytes[index] === value)
}

function readWebP(bytes: Uint8Array, view: DataView): ImageMeta {
  let width = 0
  let height = 0
  let alpha = false
  let found = false

  let offset = 12
  while (offset + 8 <= bytes.length) {
    const fourcc = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    )
    const size = view.getUint32(offset + 4, true)
    const payload = offset + 8
    if (payload + size > bytes.length) {
      break
    }

    if (fourcc === 'VP8X' && size >= 10) {
      alpha = alpha || (bytes[payload] & VP8X_ALPHA_FLAG) !== 0
      width = (bytes[payload + 4] | (bytes[payload + 5] << 8) | (bytes[payload + 6] << 16)) + 1
      height = (bytes[payload + 7] | (bytes[payload + 8] << 8) | (bytes[payload + 9] << 16)) + 1
      found = true
    } else if (fourcc === 'VP8L' && size >= 5) {
      // 14 bits of width-1, 14 bits of height-1, one alpha bit, three version bits.
      const bits =
        (bytes[payload + 1] |
          (bytes[payload + 2] << 8) |
          (bytes[payload + 3] << 16) |
          (bytes[payload + 4] << 24)) >>>
        0
      if (!found) {
        width = (bits & 0x3fff) + 1
        height = ((bits >>> 14) & 0x3fff) + 1
      }
      alpha = alpha || ((bits >>> 28) & 1) === 1
      found = true
    } else if (fourcc === 'VP8 ' && size >= 10) {
      // Three frame-tag bytes, a three-byte sync code, then 14-bit width and height.
      if (!found) {
        width = view.getUint16(payload + 6, true) & 0x3fff
        height = view.getUint16(payload + 8, true) & 0x3fff
      }
      found = true
    } else if (fourcc === 'ALPH') {
      alpha = true
    }

    offset = payload + size + (size % 2)
  }

  if (!found) {
    throw new Error('the WebP file carries no image chunk')
  }
  return { width, height, alpha }
}

function readPng(bytes: Uint8Array, view: DataView): ImageMeta {
  let offset = 8
  let width = 0
  let height = 0
  let alpha = false

  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset, false)
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    )
    const payload = offset + 8

    if (type === 'IHDR' && size >= 10) {
      width = view.getUint32(payload, false)
      height = view.getUint32(payload + 4, false)
      const colourType = bytes[payload + 9]
      // Colour type 4 is grey with alpha, 6 is truecolour with alpha.
      alpha = colourType === 4 || colourType === 6
    } else if (type === 'tRNS') {
      alpha = true
    }

    offset = payload + size + 4
    if (type === 'IEND') {
      break
    }
  }

  if (width === 0 || height === 0) {
    throw new Error('the PNG file carries no IHDR chunk')
  }
  return { width, height, alpha }
}

function readJpeg(bytes: Uint8Array, view: DataView): ImageMeta {
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = view.getUint16(offset + 2, false)
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrame) {
      const height = view.getUint16(offset + 5, false)
      const width = view.getUint16(offset + 7, false)
      return { width, height, alpha: false }
    }
    offset += 2 + length
  }
  throw new Error('the JPEG file carries no frame header')
}
