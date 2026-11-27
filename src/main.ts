import countries from './countries.generated.json';
import { answerQuestion, createRound, currentQuestion, isFinished, type Country, type Round } from './game';
import germanyUrl from './germany.svg';

const app = document.querySelector<HTMLElement>('#app')!;
const ROUND_LENGTH = 10;
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

function card(label: string, iconContent: string, onclick: () => void, className = ''): HTMLButtonElement {
  return el('button', { className: `card ${className}`.trim(), onclick }, [
    icon(iconContent),
    el('span', { className: 'label' }, [label]),
    el('span', { className: 'chevron', ariaHidden: 'true' }, ['›']),
  ]);
}

// Deutschland aus Dreiecken, Berlin und Freiburg schwarz markiert
function map(): HTMLImageElement {
  return el('img', { className: 'map', src: germanyUrl, alt: 'Deutschlandkarte aus Dreiecken mit Berlin und Freiburg' });
}

function outline(country: Country): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('class', 'outline');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Umriss eines Landes');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', country.path);
  svg.append(path);
  return svg;
}

const newRound = () => showQuestion(createRound(countries, { length: ROUND_LENGTH }));

function showStart() {
  app.replaceChildren(
    el('section', { className: 'screen start' }, [
      el('p', { className: 'kicker' }, ['Länderquiz']),
      el('h1', {}, ['Welches Land ist das?']),
      el('p', { className: 'lead' }, ['Erkennst du die Länder an ihrem Umriss?']),
      map(),
      card('Los geht’s', 'play', newRound, 'primary'),
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

  function choose(code: string) {
    const result = answerQuestion(round, code);
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
        el('span', {}, [`Frage ${round.index + 1} von ${round.questions.length}`]),
        el('span', {}, [`${round.score} richtig`]),
      ]),
      outline(question.country),
      el('div', { className: 'options' }, buttons),
      feedback,
      next,
    ]),
  );
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
