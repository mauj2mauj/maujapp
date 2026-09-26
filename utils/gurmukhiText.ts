import type { TextStyle } from 'react-native';

const GURMUKHI = /[\u0A00-\u0A7F]/;

export function containsGurmukhi(text: string): boolean {
  return GURMUKHI.test(text);
}

// Bold system fonts on Android and Windows drop every Gurmukhi word after
// the first. Latin titles stay bold. Gurmukhi titles use regular weight so
// the full phrase stays visible.
export function titleWeight(
  text: string,
  bold: TextStyle['fontWeight'] = '600'
): TextStyle['fontWeight'] {
  return containsGurmukhi(text) ? '400' : bold;
}
