// Übersichtsseite zum Prüfen aller Umrisse, nach Kontinent gruppiert
import countries from './countries.generated.json';

const list = document.querySelector<HTMLElement>('#list')!;
const continents = [...new Set(countries.map((c) => c.continent))].sort((a, b) => a.localeCompare(b, 'de'));

for (const continent of continents) {
  const inContinent = countries.filter((c) => c.continent === continent);
  const heading = document.createElement('h2');
  heading.textContent = `${continent} (${inContinent.length})`;
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const c of inContinent) {
    const figure = document.createElement('figure');
    if (c.tiny) figure.className = 'tiny';
    figure.innerHTML = `<svg viewBox="0 0 1000 1000"><path d="${c.path}"/></svg>`;
    const caption = document.createElement('figcaption');
    caption.textContent = c.name;
    if (c.tiny) {
      const badge = document.createElement('span');
      badge.className = 'tiny';
      badge.textContent = 'winzig';
      caption.append(badge);
    }
    figure.append(caption);
    grid.append(figure);
  }
  list.append(heading, grid);
}
