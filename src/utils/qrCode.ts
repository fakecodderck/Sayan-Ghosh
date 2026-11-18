import React from 'react';

/**
 * Pure TypeScript ISO 18004 QR Code Matrix Generator (Byte mode, ECC Level L/M)
 * Zero external network calls, suitable for printable UPI payment QR codes.
 */

const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x = x & 0x80 ? (x << 1) ^ 0x11d : x << 1;
  }
  EXP_TABLE[255] = EXP_TABLE[0];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}

function rsGeneratorPoly(deg: number): Uint8Array {
  let poly: number[] = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const root = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return Uint8Array.from(poly);
}

function rsComputeEcc(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j++) {
      res[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return res;
}

// Version 1..10 EC Level M parameters: [totalCodewords, ecPerBlock, blocksG1, dataG1, blocksG2, dataG2]
const VERSION_SPEC_M: Record<number, [number, number, number, number, number, number]> = {
  1: [26, 10, 1, 16, 0, 0],
  2: [44, 16, 1, 28, 0, 0],
  3: [70, 26, 1, 44, 0, 0],
  4: [100, 18, 2, 32, 0, 0],
  5: [134, 24, 2, 43, 0, 0],
  6: [172, 16, 4, 27, 0, 0],
  7: [196, 18, 4, 31, 0, 0],
  8: [242, 22, 2, 38, 2, 39],
  9: [292, 22, 3, 36, 2, 37],
  10: [346, 26, 4, 43, 1, 44],
};

const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const FORMAT_INFO_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
];

function getVersionForByteLength(len: number): number {
  for (let v = 1; v <= 10; v++) {
    const [, , b1, d1, b2, d2] = VERSION_SPEC_M[v];
    const dataBytes = b1 * d1 + b2 * d2;
    const headerBits = 4 + (v <= 9 ? 8 : 16);
    const maxDataBytes = Math.floor((dataBytes * 8 - headerBits) / 8);
    if (len <= maxDataBytes) return v;
  }
  return 10;
}

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = getVersionForByteLength(bytes.length);
  const size = version * 4 + 17;
  const [, ecPerBlock, b1, d1, b2, d2] = VERSION_SPEC_M[version];
  const totalDataBytes = b1 * d1 + b2 * d2;

  // Build bit buffer (Byte mode indicator 0100)
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4);
  const countBits = version <= 9 ? 8 : 16;
  const maxBytes = Math.floor((totalDataBytes * 8 - 4 - countBits) / 8);
  const clipped = bytes.slice(0, maxBytes);
  pushBits(clipped.length, countBits);
  for (const b of clipped) pushBits(b, 8);

  const totalDataBits = totalDataBytes * 8;
  for (let i = 0; i < 4 && bits.length < totalDataBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords = new Uint8Array(totalDataBytes);
  let idx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | bits[i + j];
    dataCodewords[idx++] = val;
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (idx < totalDataBytes) {
    dataCodewords[idx++] = padBytes[padIdx % 2];
    padIdx++;
  }

  // Split blocks and generate RS ECC
  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let i = 0; i < b1; i++) {
    const blk = dataCodewords.slice(offset, offset + d1);
    dataBlocks.push(blk);
    eccBlocks.push(rsComputeEcc(blk, ecPerBlock));
    offset += d1;
  }
  for (let i = 0; i < b2; i++) {
    const blk = dataCodewords.slice(offset, offset + d2);
    dataBlocks.push(blk);
    eccBlocks.push(rsComputeEcc(blk, ecPerBlock));
    offset += d2;
  }

  // Interleave
  const finalBytes: number[] = [];
  const maxD = Math.max(d1, d2);
  for (let c = 0; c < maxD; c++) {
    for (const blk of dataBlocks) {
      if (c < blk.length) finalBytes.push(blk[c]);
    }
  }
  for (let c = 0; c < ecPerBlock; c++) {
    for (const blk of eccBlocks) {
      finalBytes.push(blk[c]);
    }
  }

  // Initialize module & function grid
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = dark;
      isFunction[r][c] = true;
    }
  };

  const drawFinder = (row: number, col: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        const dark = dist !== 2 && dist !== 4;
        setFunc(r, c, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    if (!isFunction[6][i]) setFunc(6, i, dark);
    if (!isFunction[i][6]) setFunc(i, 6, dark);
  }

  // Alignment patterns
  const alignCoords = ALIGNMENT_POSITIONS[version];
  for (const r of alignCoords) {
    for (const c of alignCoords) {
      if ((r < 9 && c < 9) || (r < 9 && c > size - 10) || (r > size - 10 && c < 9)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunc(r + dr, c + dc, dist !== 1);
        }
      }
    }
  }

  // Reserve format info & dark module
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
  }
  for (let i = size - 8; i < size; i++) {
    setFunc(8, i, false);
    setFunc(i, 8, false);
  }
  setFunc(size - 8, 8, true);

  // Version info for >= 7
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
    const vBits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((vBits >> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(a, b, dark);
      setFunc(b, a, dark);
    }
  }

  // Place data bits zigzag
  let bitIdx = 0;
  const totalPayloadBits = finalBytes.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIdx < totalPayloadBits) {
          const b = finalBytes[bitIdx >> 3];
          modules[y][x] = ((b >> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
      }
    }
  }

  // Evaluate mask patterns 0..7 and choose lowest penalty
  const applyMask = (mask: number, grid: boolean[][]) => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (isFunction[r][c]) continue;
        let invert = false;
        switch (mask) {
          case 0: invert = (r + c) % 2 === 0; break;
          case 1: invert = r % 2 === 0; break;
          case 2: invert = c % 3 === 0; break;
          case 3: invert = (r + c) % 3 === 0; break;
          case 4: invert = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
          case 5: invert = ((r * c) % 2) + ((r * c) % 3) === 0; break;
          case 6: invert = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break;
          case 7: invert = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; break;
        }
        if (invert) grid[r][c] = !grid[r][c];
      }
    }
  };

  const penalty = (grid: boolean[][]): number => {
    let score = 0;
    for (let r = 0; r < size; r++) {
      let runLen = 1;
      for (let c = 1; c < size; c++) {
        if (grid[r][c] === grid[r][c - 1]) {
          runLen++;
        } else {
          if (runLen >= 5) score += 3 + (runLen - 5);
          runLen = 1;
        }
      }
      if (runLen >= 5) score += 3 + (runLen - 5);
    }
    for (let c = 0; c < size; c++) {
      let runLen = 1;
      for (let r = 1; r < size; r++) {
        if (grid[r][c] === grid[r - 1][c]) {
          runLen++;
        } else {
          if (runLen >= 5) score += 3 + (runLen - 5);
          runLen = 1;
        }
      }
      if (runLen >= 5) score += 3 + (runLen - 5);
    }
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const val = grid[r][c];
        if (grid[r][c + 1] === val && grid[r + 1][c] === val && grid[r + 1][c + 1] === val) {
          score += 3;
        }
      }
    }
    return score;
  };

  let bestMask = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    const copy = modules.map(row => [...row]);
    applyMask(m, copy);
    const s = penalty(copy);
    if (s < bestScore) {
      bestScore = s;
      bestMask = m;
    }
  }

  applyMask(bestMask, modules);

  // Write format info
  const fmt = FORMAT_INFO_M[bestMask];
  for (let i = 0; i <= 5; i++) {
    const dark = ((fmt >> i) & 1) === 1;
    modules[8][i] = dark;
    modules[size - 1 - i][8] = dark;
  }
  modules[8][7] = ((fmt >> 6) & 1) === 1;
  modules[size - 7][8] = ((fmt >> 6) & 1) === 1;
  modules[8][8] = ((fmt >> 7) & 1) === 1;
  modules[8][size - 8] = ((fmt >> 7) & 1) === 1;
  modules[7][8] = ((fmt >> 8) & 1) === 1;
  modules[8][size - 7] = ((fmt >> 8) & 1) === 1;
  for (let i = 9; i < 15; i++) {
    const dark = ((fmt >> i) & 1) === 1;
    modules[14 - i][8] = dark;
    modules[8][size - 15 + i] = dark;
  }

  return modules;
}

export function buildUpiPaymentUri(
  upiId: string,
  payeeName: string,
  amount?: number,
  note?: string
): string {
  const params = new URLSearchParams();
  params.set('pa', upiId.trim());
  params.set('pn', payeeName.trim() || 'Merchant');
  if (amount && amount > 0) {
    params.set('am', amount.toFixed(2));
  }
  params.set('cu', 'INR');
  if (note) {
    params.set('tn', note.slice(0, 40));
  }
  return `upi://pay?${params.toString()}`;
}

export const QrCodeSvg: React.FC<{
  value: string;
  size?: number;
  className?: string;
}> = ({ value, size = 76, className = '' }) => {
  const matrix = React.useMemo(() => {
    if (!value) return [];
    return generateQrMatrix(value);
  }, [value]);

  if (matrix.length === 0) return null;
  const count = matrix.length;
  const pad = 2;
  const viewSize = count + pad * 2;

  const rects: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        rects.push(`M${c + pad},${r + pad}h1v1h-1z`);
      }
    }
  }

  return React.createElement(
    'svg',
    {
      width: size,
      height: size,
      viewBox: `0 0 ${viewSize} ${viewSize}`,
      className,
      shapeRendering: 'crispEdges',
      role: 'img',
      'aria-label': 'UPI Payment QR Code',
    },
    React.createElement('rect', { x: 0, y: 0, width: viewSize, height: viewSize, fill: '#ffffff' }),
    React.createElement('path', { d: rects.join(''), fill: '#0f172a' })
  );
};
