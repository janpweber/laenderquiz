import allCountries from './countries.generated.json';
import {
  CONTINENTS,
  answerQuestion,
  clampLength,
  createRound,
  currentQuestion,
  endRound,
  filterCountries,
  isFinished,
  type Country,
  type Round,
} from './game';
import germanySvg from './germany.svg?raw';
import { loadSettings, normalize, saveSettings, summary, type Settings } from './settings';

const app = document.querySelector<HTMLElement>('#app')!;
const pool = (s: Settings) => filterCountries(allCountries, s);
let settings: Settings = normalize(loadSettings(), allCountries.length);
settings = normalize(settings, pool(settings).length);
const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// Kleine Strich-Icons im Kreis, wie auf havaslifeberlin.de
const ICONS = {
  play: 'M10 8 L17 12 L10 16 Z',
  arrow: 'M7 12 H17 M13 8 L17 12 L13 16',
  again: 'M17 9 A6 6 0 1 0 18 13 M17 5 V9 H13',
  settings: 'M5 7 H19 M5 12 H19 M5 17 H19 M9 5 V9 M15 10 V14 M8 15 V19',
  check: 'M6 12 L10 16 L18 8',
  stop: 'M8 8 H16 V16 H8 Z',
};

function icon(content: keyof typeof ICONS | string): HTMLSpanElement {
  const wrap = el('span', { className: 'icon' });
  if (content in ICONS) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[content as keyof typeof ICONS]);
    svg.append(path);
    wrap.append(svg);
  } else {
    wrap.textContent = content;
  }
  return wrap;
}

function card(
  label: string,
  iconContent: string,
  onclick: () => void,
  className = '',
  sublabel?: string,
): HTMLButtonElement {
  return el('button', { className: `card ${className}`.trim(), onclick }, [
    icon(iconContent),
    el('span', { className: 'label' }, [label, ...(sublabel ? [el('small', {}, [sublabel])] : [])]),
    el('span', { className: 'chevron', ariaHidden: 'true' }, ['›']),
  ]);
}

// Auswahl-Chips für die Einstellungen
function chips<T>(options: { label: string; value: T }[], selected: (v: T) => boolean, onpick: (v: T) => void) {
  return el(
    'div',
    { className: 'chips', role: 'group' },
    options.map((o) =>
      el('button', { className: selected(o.value) ? 'chip selected' : 'chip', onclick: () => onpick(o.value) }, [o.label]),
    ),
  );
}

// Deutschland aus Dreiecken, Berlin und Freiburg schwarz markiert
// Inline eingebunden, damit die Animation bei jedem Anzeigen neu startet
function map(): HTMLDivElement {
  const wrap = el('div', { className: 'map' });
  wrap.innerHTML = germanySvg;
  return wrap;
}

function outline(country: Country): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  // Winzige Staaten bekommen eine dicke Kontur, damit sie überhaupt sichtbar sind
  svg.setAttribute('class', country.tiny ? 'outline tiny' : 'outline');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Umriss eines Landes');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', country.path);
  svg.append(path);
  return svg;
}

const newRound = () => showQuestion(createRound(pool(settings), { length: settings.length }));

function showSettings() {
  const available = pool(settings).length;
  const isCustom = typeof settings.length === 'number' && settings.length !== 10 && settings.length !== 20;
  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    // Bei weniger verfügbaren Ländern die eigene Zahl mitkürzen
    settings = typeof next.length === 'number' ? { ...next, length: clampLength(next.length, pool(next).length) } : next;
    saveSettings(settings);
    showSettings();
  };

  const custom = el('input', {
    type: 'number',
    min: '1',
    max: String(available),
    value: String(isCustom ? settings.length : Math.min(15, available)),
    inputMode: 'numeric',
    ariaLabel: `Anzahl Länder, 1 bis ${available}`,
  });
  custom.onchange = () => update({ length: clampLength(Number(custom.value), available) });

  app.replaceChildren(
    el('section', { className: 'screen settings' }, [
      el('p', { className: 'kicker' }, ['Länderquiz']),
      el('h1', {}, ['Einstellungen']),
      el('h2', {}, ['Rundenlänge']),
      chips<string>(
        [
          { label: '10', value: '10' },
          { label: '20', value: '20' },
          { label: 'Endlos', value: 'endlos' },
          { label: 'Eigene', value: 'eigene' },
        ],
        (v) => (v === 'eigene' ? isCustom : String(settings.length) === v && !isCustom),
        (v) =>
          update({
            length: v === 'endlos' ? 'endlos' : v === 'eigene' ? clampLength(Number(custom.value), available) : Number(v),
          }),
      ),
      el('label', { className: 'custom', hidden: !isCustom }, [custom, el('span', {}, [`von 1 bis ${available} Ländern`])]),
      el('h2', {}, ['Kontinent']),
      chips(
        CONTINENTS.map((c) => ({ label: c === 'Welt' ? 'Ganze Welt' : c, value: c })),
        (v) => settings.continent === v,
        (v) => update({ continent: v }),
      ),
      el('h2', {}, ['Schwierigkeit']),
      chips(
        [
          { label: 'Normal', value: 'normal' as const },
          { label: 'Schwer', value: 'schwer' as const },
        ],
        (v) => settings.difficulty === v,
        (v) => update({ difficulty: v }),
      ),
      el('p', { className: 'hint' }, ['„Schwer“ enthält auch 24 winzige Staaten wie Monaco oder Tuvalu.']),
      card('Fertig', 'check', showStart, 'primary', summary(settings, available)),
    ]),
  );
}

function showStart() {
  app.replaceChildren(
    el('section', { className: 'screen start' }, [
      el('p', { className: 'kicker' }, ['Länderquiz']),
      el('h1', {}, ['Welches Land ist das?']),
      el('p', { className: 'lead' }, ['Erkennst du die Länder an ihrem Umriss?']),
      map(),
      card('Los geht’s', 'play', newRound, 'primary'),
      card('Einstellungen', 'settings', showSettings, 'secondary', summary(settings, pool(settings).length)),
    ]),
  );
}

function showQuestion(round: Round) {
  if (isFinished(round)) return showResult(round);
  const question = currentQuestion(round)!;
  const feedback = el('p', { className: 'feedback', ariaLive: 'polite' });
  const next = card('Weiter', 'arrow', () => {}, 'primary next');
  next.hidden = true;

  const buttons = question.options.map((option, i) =>
    card(option.name, 'ABCD'[i], () => choose(option.code), 'option'),
  );

  // Stand nach der Antwort, damit „Runde beenden“ die aktuelle Antwort mitzählt
  let latest = round;

  function choose(code: string) {
    const result = answerQuestion(round, code);
    latest = result.round;
    buttons.forEach((button, i) => {
      button.disabled = true;
      const optionCode = question.options[i].code;
      if (optionCode === result.correctCountry.code) button.classList.add('correct');
      else if (optionCode === code) button.classList.add('wrong');
    });
    feedback.textContent = result.correct ? 'Richtig!' : `Leider falsch. Das war ${result.correctCountry.name}.`;
    feedback.className = `feedback ${result.correct ? 'good' : 'bad'}`;
    next.querySelector('.label')!.textContent = isFinished(result.round) ? 'Zum Ergebnis' : 'Weiter';
    next.onclick = () => showQuestion(result.round);
    next.hidden = false;
    next.focus();
  }

  app.replaceChildren(
    el('section', { className: 'screen game' }, [
      el('header', { className: 'status' }, [
        el('span', {}, [round.endless ? `Frage ${round.index + 1}` : `Frage ${round.index + 1} von ${round.questions.length}`]),
        el('span', {}, [`${round.score} richtig`]),
      ]),
      outline(question.country),
      el('div', { className: 'options' }, buttons),
      feedback,
      next,
      ...(round.endless
        ? [el('button', { className: 'text-button', onclick: () => finish(endRound(latest)) }, ['Runde beenden'])]
        : []),
    ]),
  );
}

function finish(round: Round) {
  // Im Endlosmodus ohne beantwortete Frage zurück zum Start
  if (round.questions.length === 0) return showStart();
  showResult(round);
}

function showResult(round: Round) {
  const total = round.questions.length;
  app.replaceChildren(
    el('section', { className: 'screen result' }, [
      el('p', { className: 'kicker' }, ['Ergebnis']),
      el('h1', {}, ['Geschafft!']),
      el('p', { className: 'score' }, [`${round.score} von ${total}`]),
      el('p', { className: 'lead' }, [round.score === total ? 'Perfekt, alle richtig!' : 'Länder richtig erkannt']),
      map(),
      card('Neue Runde', 'again', newRound, 'primary'),
    ]),
  );
}

showStart();
