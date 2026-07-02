// Generate PWA PNG icons from SVG using a canvas-free approach
// Writes minimal valid PNG files for PWA manifest

const fs = require('fs');
const path = require('path');

const SIZES = [192, 512];

function createMinimalPNG(size) {
  // Create a minimal valid PNG with our icon color
  // This is a 1-pixel PNG that will be replaced by the actual icon
  // For production, generate proper icons using a tool like https://www.pwabuilder.com/

  const PNG_HEADER = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  ]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData.writeUInt8(8, 8);        // bit depth
  ihdrData.writeUInt8(2, 9);        // color type (RGB)
  ihdrData.writeUInt8(0, 10);       // compression
  ihdrData.writeUInt8(0, 11);       // filter
  ihdrData.writeUInt8(0, 12);       // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createIDATChunk(size);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([PNG_HEADER, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function createIDATChunk(size) {
  // Create raw image data (RGB, no alpha)
  const rawData = [];
  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte (none)
    for (let x = 0; x < size; x++) {
      // Check if we're in the rounded rect area
      const cx = size / 2, cy = size / 2;
      const rx = size * 0.35, ry = size * 0.35;
      const inIcon = (Math.abs(x - cx) < rx && Math.abs(y - cy) < ry);
      
      if (inIcon) {
        // Blue gradient
        const dist = Math.sqrt(Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2));
        const r = Math.round(37 + dist * 20);
        const g = Math.round(99 + dist * 30);
        const b = Math.round(235 - dist * 30);
        rawData.push(r, g, b);
      } else {
        // Check if text area
        const textY = y > size * 0.45 && y < size * 0.65;
        const textX = x > size * 0.2 && x < size * 0.8;
        const inText = textY && textX;
        
        if (inText) {
          rawData.push(255, 255, 255);
        } else {
          // Blue background
          const dist = Math.sqrt(Math.pow((x - cx) / (size/2), 2) + Math.pow((y - cy) / (size/2), 2));
          const r = Math.round(37 + dist * 10);
          const g = Math.round(99 + dist * 10);
          const b = Math.round(235 - dist * 10);
          rawData.push(r, g, b);
        }
      }
    }
  }

  // Compress with zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  return createChunk('IDAT', compressed);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const outDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

SIZES.forEach(size => {
  const png = createMinimalPNG(size);
  const outPath = path.join(outDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${png.length} bytes)`);
});

console.log('Done! Replace these with properly generated icons for production.');
console.log('Use https://www.pwabuilder.com/ or similar tool.');
