const IMAGE_DATA_URI_PATTERN = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/i;

export const decodeImageDataUri = (value) => {
  const match = String(value || '').match(IMAGE_DATA_URI_PATTERN);
  if (!match || match[2].length % 4 !== 0) return null;

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.toString('base64') !== match[2]) return null;

  const mimeType = match[1].toLowerCase();
  const isPng =
    mimeType === 'image/png' &&
    buffer.length >= 24 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    buffer.readUInt32BE(16) > 0 &&
    buffer.readUInt32BE(20) > 0;
  const isJpeg =
    mimeType === 'image/jpeg' &&
    buffer.length >= 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff &&
    buffer[buffer.length - 2] === 0xff &&
    buffer[buffer.length - 1] === 0xd9;

  return isPng || isJpeg ? { buffer, mimeType, size: buffer.length } : null;
};
