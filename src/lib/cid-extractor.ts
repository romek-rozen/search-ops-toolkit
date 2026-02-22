/**
 * Wyciąga CID (Client ID) z URL-a Google Maps.
 *
 * Obsługiwane formaty:
 * - ?ludocid=XXXXXXX
 * - data=!1s0x...!2sXXXXXX (hex CID w fragmencie URL)
 * - /maps/place/.../@.../data=...!1sXXXXX:YYYY
 */
export function extractCidFromUrl(url: string): string | null {
  // 0. Direct ?cid= parameter (decimal number)
  const cidMatch = url.match(/[?&]cid=(\d+)/);
  if (cidMatch) {
    return cidMatch[1];
  }

  // 1. ludocid parametr
  const ludocidMatch = url.match(/[?&]ludocid=(\d+)/);
  if (ludocidMatch) {
    return ludocidMatch[1];
  }

  // 2. Fragment data= z !1s prefixem (hex format 0x...)
  // np. !1s0x48761b31e3eb6cb1:0x47e0dd73e474be11
  const hexCidMatch = url.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (hexCidMatch) {
    const hexPart = hexCidMatch[1].split(":")[1];
    if (hexPart) {
      const decimal = BigInt(hexPart).toString();
      return decimal;
    }
  }

  // 3. Próba wyciągnięcia z ftid= parametru
  const ftidMatch = url.match(/[?&]ftid=(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (ftidMatch) {
    const hexPart = ftidMatch[1].split(":")[1];
    if (hexPart) {
      return BigInt(hexPart).toString();
    }
  }

  return null;
}
