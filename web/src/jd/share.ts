// A shared fit report carries its job description inside the link, after the #, compressed.
// Browsers never send the part after # to a server, so the JD stays between the people who share it.

type Bytes = Uint8Array<ArrayBuffer>;

function toB64url(bytes: Bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Bytes {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function through(bytes: Bytes, stream: CompressionStream | DecompressionStream): Promise<Bytes> {
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

/** 'z' + deflate-raw + base64url where the browser can compress, else 'u' + plain base64url. */
export async function encodeJd(text: string): Promise<string> {
  const raw = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'function') {
    try { return 'z' + toB64url(await through(raw, new CompressionStream('deflate-raw'))); } catch { /* fall back */ }
  }
  return 'u' + toB64url(raw);
}

/** The job description from a shared link, or null if the link is damaged. */
export async function decodeJd(code: string): Promise<string | null> {
  try {
    const bytes = fromB64url(code.slice(1));
    if (code[0] === 'u') return new TextDecoder().decode(bytes);
    if (code[0] === 'z' && typeof DecompressionStream === 'function') {
      return new TextDecoder().decode(await through(bytes, new DecompressionStream('deflate-raw')));
    }
  } catch { /* damaged */ }
  return null;
}
