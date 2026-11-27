import countries from './countries.generated.json';
import { answerQuestion, createRound, currentQuestion, isFinished, type Country, type Round } from './game';

const app = document.querySelector<HTMLElement>('#app')!;
const ROUND_LENGTH = 10;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function outline(country: Country): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('class', 'outline');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Umriss eines Landes');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', country.path);
  svg.append(path);
  return svg;
}

function showStart() {
  app.replaceChildren(
    el('section', { className: 'screen start' }, [
      el('p', { className: 'kicker' }, ['Länderquiz']),
      el('h1', {}, ['welches land ist das?']),
      el('p', { className: 'lead' }, ['Erkennst du die Länder an ihrem Umriss?']),
      el('button', { className: 'primary', onclick: () => showQuestion(createRound(countries, { length: ROUND_LENGTH })) }, [
        'Los geht’s',
      ]),
    ]),
  );
}

function showQuestion(round: Round) {
  if (isFinished(round)) return showResult(round);
  const question = currentQuestion(round)!;
  const feedback = el('p', { className: 'feedback', ariaLive: 'polite' });
  const next = el('button', { className: 'primary next', hidden: true }, ['Weiter']);

  const buttons = question.options.map((option) =>
    el('button', { className: 'option', onclick: () => choose(option.code) }, [option.name]),
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
    next.textContent = isFinished(result.round) ? 'Zum Ergebnis' : 'Weiter';
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
      el('h1', {}, ['geschafft!']),
      el('p', { className: 'score' }, [`${round.score} von ${total}`]),
      el('p', { className: 'lead' }, [round.score === total ? 'Perfekt, alle richtig!' : 'Länder richtig erkannt']),
      el('button', { className: 'primary', onclick: () => showQuestion(createRound(countries, { length: ROUND_LENGTH })) }, [
        'Neue Runde',
      ]),
    ]),
  );
}

showStart();
