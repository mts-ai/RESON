/* Sync gzip decoder for self-contained RESON HTML reports (iOS Safari).
 * Raw inflate follows the tiny-inflate approach (MIT, Devon Govett / foliojs).
 */
function resonB64ToU8(b64) {
  var bin = atob(String(b64).replace(/\s+/g, ""));
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function resonInflateRaw(src) {
  var dest = new Uint8Array(Math.max(src.length * 4, 1024));
  var destLen = 0;
  function ensure(more) {
    if (destLen + more <= dest.length) return;
    var next = new Uint8Array(Math.max(dest.length * 2, destLen + more));
    next.set(dest);
    dest = next;
  }
  function push(v) {
    ensure(1);
    dest[destLen++] = v;
  }

  var TINF_OK = 0;
  var TINF_DATA_ERROR = -3;
  var length_bits = new Uint8Array(30);
  var length_base = new Uint16Array(30);
  var dist_bits = new Uint8Array(30);
  var dist_base = new Uint16Array(30);
  var sltree = { table: new Uint16Array(16), trans: new Uint16Array(288) };
  var sdtree = { table: new Uint16Array(16), trans: new Uint16Array(32) };

  (function buildBitsBase(bits, base, delta, first) {
    var i, sum = first;
    for (i = 0; i < delta; ++i) bits[i] = 0;
    for (i = 0; i < 30 - delta; ++i) bits[i + delta] = (i / delta) | 0;
    for (i = 0; i < 30; ++i) {
      base[i] = sum;
      sum += 1 << bits[i];
    }
  })(length_bits, length_base, 4, 3);
  length_bits[28] = 0;
  length_base[28] = 258;
  (function buildDist() {
    var i, sum = 1;
    for (i = 0; i < 30; ++i) {
      dist_bits[i] = (i < 2 ? 0 : ((i - 2) / 2) | 0);
      dist_base[i] = sum;
      sum += 1 << dist_bits[i];
    }
  })();

  (function buildFixedTrees() {
    var i;
    for (i = 0; i < 7; ++i) sltree.table[i] = 0;
    sltree.table[7] = 24;
    sltree.table[8] = 152;
    sltree.table[9] = 112;
    for (i = 0; i < 24; ++i) sltree.trans[i] = 256 + i;
    for (i = 0; i < 144; ++i) sltree.trans[24 + i] = i;
    for (i = 0; i < 8; ++i) sltree.trans[168 + i] = 280 + i;
    for (i = 0; i < 112; ++i) sltree.trans[176 + i] = 144 + i;
    for (i = 0; i < 5; ++i) sdtree.table[i] = 0;
    sdtree.table[5] = 32;
    for (i = 0; i < 32; ++i) sdtree.trans[i] = i;
  })();

  var sourceIndex = 0;
  var bitcount = 0;
  var tag = 0;
  function getBits(num) {
    var val = 0;
    var shift = 0;
    while (shift < num) {
      if (bitcount === 0) {
        tag = src[sourceIndex++];
        bitcount = 8;
      }
      val |= (tag & 1) << shift;
      tag >>>= 1;
      bitcount--;
      shift++;
    }
    return val;
  }

  function buildTree(ltree, lengths, num) {
    var offs = new Uint16Array(16);
    var i, sum, t;
    for (i = 0; i < 16; ++i) ltree.table[i] = 0;
    for (i = 0; i < num; ++i) ltree.table[lengths[i]]++;
    ltree.table[0] = 0;
    offs[0] = 0;
    for (sum = 0, i = 0; i < 16; ++i) {
      offs[i] = sum;
      sum += ltree.table[i];
    }
    for (i = 0; i < num; ++i) {
      if (lengths[i]) ltree.trans[offs[lengths[i]]++] = i;
    }
    /* silence unused */
    t = sum;
  }

  function decodeSymbol(ltree) {
    var sum = 0, cur = 0, len = 0;
    do {
      cur = 2 * cur + getBits(1);
      len++;
      sum += ltree.table[len];
      cur -= ltree.table[len];
    } while (cur >= 0);
    return ltree.trans[sum + cur];
  }

  function inflateBlockData(ltree, dtree) {
    var sym, len, dist, offs, i;
    while (true) {
      sym = decodeSymbol(ltree);
      if (sym === 256) return TINF_OK;
      if (sym < 256) {
        push(sym);
      } else {
        sym -= 257;
        len = getBits(length_bits[sym]) + length_base[sym];
        dist = decodeSymbol(dtree);
        offs = getBits(dist_bits[dist]) + dist_base[dist];
        ensure(len);
        for (i = 0; i < len; ++i) dest[destLen + i] = dest[destLen - offs + i];
        destLen += len;
      }
    }
  }

  function inflateUncompressedBlock() {
    var len, invlen, i;
    bitcount = 0;
    len = src[sourceIndex] | (src[sourceIndex + 1] << 8);
    invlen = src[sourceIndex + 2] | (src[sourceIndex + 3] << 8);
    sourceIndex += 4;
    if (len !== (~invlen & 0xffff)) return TINF_DATA_ERROR;
    ensure(len);
    for (i = 0; i < len; ++i) dest[destLen++] = src[sourceIndex++];
    return TINF_OK;
  }

  var clcidx = [
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
  ];

  function inflateDynamicBlock() {
    var hlit, hdist, hclen, i, code, prev, lnum, dnum, n;
    var lengths = new Uint8Array(320);
    var htree = { table: new Uint16Array(16), trans: new Uint16Array(19) };
    var ltree = { table: new Uint16Array(16), trans: new Uint16Array(288) };
    var dtree = { table: new Uint16Array(16), trans: new Uint16Array(32) };
    hlit = getBits(5) + 257;
    hdist = getBits(5) + 1;
    hclen = getBits(4) + 4;
    for (i = 0; i < 19; ++i) lengths[i] = 0;
    for (i = 0; i < hclen; ++i) lengths[clcidx[i]] = getBits(3);
    buildTree(htree, lengths, 19);
    lnum = 0;
    while (lnum < hlit + hdist) {
      code = decodeSymbol(htree);
      if (code < 16) {
        lengths[lnum++] = code;
      } else if (code === 16) {
        prev = lengths[lnum - 1];
        n = getBits(2) + 3;
        while (n--) lengths[lnum++] = prev;
      } else if (code === 17) {
        n = getBits(3) + 3;
        while (n--) lengths[lnum++] = 0;
      } else {
        n = getBits(7) + 11;
        while (n--) lengths[lnum++] = 0;
      }
    }
    buildTree(ltree, lengths, hlit);
    buildTree(dtree, lengths.subarray(hlit, hlit + hdist), hdist);
    return inflateBlockData(ltree, dtree);
  }

  var bfinal, btype, res;
  do {
    bfinal = getBits(1);
    btype = getBits(2);
    if (btype === 0) res = inflateUncompressedBlock();
    else if (btype === 1) res = inflateBlockData(sltree, sdtree);
    else if (btype === 2) res = inflateDynamicBlock();
    else return null;
    if (res !== TINF_OK) return null;
  } while (!bfinal);
  return dest.subarray(0, destLen);
}

function resonInflateGzip(bytes) {
  if (bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8) {
    throw new Error("RESON gzip: invalid header");
  }
  var flg = bytes[3];
  var offset = 10;
  if (flg & 4) {
    var xlen = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2 + xlen;
  }
  if (flg & 8) {
    while (bytes[offset++] !== 0) {}
  }
  if (flg & 16) {
    while (bytes[offset++] !== 0) {}
  }
  if (flg & 2) offset += 2;
  var raw = bytes.subarray(offset, bytes.length - 8);
  var out = resonInflateRaw(raw);
  if (!out) throw new Error("RESON gzip: inflate failed");
  return out;
}

function resonGunzipUtf8(b64) {
  var u8 = resonInflateGzip(resonB64ToU8(b64));
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(u8);
  }
  var s = "";
  for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return decodeURIComponent(escape(s));
}
