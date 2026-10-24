/**
 * NumPy v1.0 Binary Tensor Serializer (.npy).
 * Specification: Magic \x93NUMPY (6 bytes) + Version 1.0 (2 bytes) + HeaderLen (uint16 LE) +
 * Python dict header padded to 64-byte alignment ending with '\n' + raw IEEE-754 float32 data.
 */

export function serializeNpyTensor(data: Float32Array, shape: [number, number]): ArrayBuffer {
  const magic = new Uint8Array([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]); // \x93NUMPY
  const version = new Uint8Array([0x01, 0x00]);

  let dictHeader = `{'descr': '<f4', 'fortran_order': False, 'shape': (${shape[0]}, ${shape[1]}), }`;
  // Prefix = 10 bytes (6 magic + 2 version + 2 headerLen). Total header must align to 64 bytes.
  const currentLen = 10 + dictHeader.length + 1; // +1 for trailing '\n'
  const remainder = currentLen % 64;
  const padLen = remainder === 0 ? 0 : 64 - remainder;
  dictHeader += ' '.repeat(padLen) + '\n';

  const headerLen = dictHeader.length;
  const headerLenBytes = new Uint8Array([headerLen & 0xff, (headerLen >> 8) & 0xff]);

  const totalLength = 10 + headerLen + data.byteLength;
  const buffer = new ArrayBuffer(totalLength);
  const u8View = new Uint8Array(buffer);

  u8View.set(magic, 0);
  u8View.set(version, 6);
  u8View.set(headerLenBytes, 8);
  for (let i = 0; i < dictHeader.length; i++) {
    u8View[10 + i] = dictHeader.charCodeAt(i);
  }

  const dataView = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  u8View.set(dataView, 10 + headerLen);

  return buffer;
}
