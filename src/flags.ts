// Flaggen als einzelne SVG-Dateien, die erst beim Hinweis geladen werden.
// Quelle: flag-icons (MIT), siehe src/flags/LICENSE-flag-icons
const urls = import.meta.glob('./flags/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export function hasFlag(code: string): boolean {
  return `./flags/${code}.svg` in urls;
}

export function flagUrl(code: string): string | undefined {
  return urls[`./flags/${code}.svg`];
}
