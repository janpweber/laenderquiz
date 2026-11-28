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
  type Question,
  type Round,
} from './game';
import germanySvg from './germany.svg?raw';
import { contextMap, enableGestures, preloadWorld, sizeComparison, zoomOut } from './context-map';
import { formatTime, startQuestionClock } from './timer';
import { browserStore, loadRecords, recordKey, submitResult, type RecordEntry } from './record';
import { RANKED, rankedLabel, rankedSettings, type RankedMode } from './ranked';
import { LeaderboardError, fetchTop, plausible, submitEntry } from './leaderboard';
import { NAME_MAX, checkName } from './name';
import { flagUrl } from './flags';
import {
  CHALLENGE_ATTEMPTS,
  CHALLENGE_LENGTHS,
  TITLE_MAX,
  attemptsUsed,
  challengeRound,
  challengeSettings,
  conditions,
  createChallenge,
  fetchChallenge,
  fetchChallengeResults,
  fixQuestions,
  playerId,
  submitChallengeResult,
  useAttempt,
  type Challenge,
  type ChallengeSetup,
} from './challenge';
import { TEMPOS, loadSettings, normalize, saveSettings, summary, type Settings } from './settings';

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
  trophy: 'M8 5 H16 V10 A4 4 0 0 1 8 10 Z M8 7 H5 V8 A3 3 0 0 0 8 11 M16 7 H19 V8 A3 3 0 0 1 16 11 M12 14 V17 M9 19 H15',
  flag: 'M6 21 V4 M6 4 H17 L15 8 L17 12 H6',
  list: 'M9 7 H18 M9 12 H18 M9 17 H18 M5.5 7 H6 M5.5 12 H6 M5.5 17 H6',
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

// Kleiner gestrichelter Deutschland-Umriss als Symbol für den Größenvergleich
const germanyPath = allCountries.find((c) => c.code === 'DEU')?.path ?? '';
function germanyIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '150 0 700 1000');
  svg.setAttribute('class', 'icon-de');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', germanyPath);
  svg.append(path);
  return svg;
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

// Einstellungen der laufenden Runde. Für die Bestenliste zählt nur, was über
// „Rangliste“ gestartet wurde, freies Spiel nie (auch nicht mit gleichen Einstellungen).
let active: Settings = settings;
let activeRanked: RankedMode | undefined;
// Laufende Challenge-Runde: welche Challenge, welcher Versuch, unter welchem Namen
let activeChallenge: { challenge: Challenge; attempt: number; name: string } | undefined;
function startRound(s: Settings, ranked?: RankedMode) {
  active = s;
  activeRanked = ranked;
  activeChallenge = undefined;
  showQuestion(createRound(pool(s), { length: s.length }));
}
function startRanked(mode: RankedMode) {
  startRound(rankedSettings(mode), mode);
}
const newRound = () => startRound(active, activeRanked);

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

  // Schieberegler zusätzlich zur Zahl: beim Ziehen läuft die Zahl mit,
  // gespeichert wird beim Loslassen
  const slider = el('input', {
    type: 'range',
    min: '1',
    max: String(available),
    step: '1',
    value: custom.value,
    ariaLabel: 'Anzahl Länder',
  });
  slider.oninput = () => (custom.value = slider.value);
  slider.onchange = () => update({ length: clampLength(Number(slider.value), available) });
  custom.oninput = () => (slider.value = custom.value);

  app.replaceChildren(
    el('section', { className: 'screen settings' }, [
      el('p', { className: 'kicker' }, ['Freies Spiel']),
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
      el('div', { className: 'custom', hidden: !isCustom }, [
        el('label', { className: 'custom-row' }, [custom, el('span', {}, [`von 1 bis ${available} Ländern`])]),
        slider,
      ]),
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
      el('h2', {}, ['Tempo']),
      chips(
        TEMPOS.map((t) => ({ label: t === 0 ? 'Ohne Limit' : `${t} s`, value: t })),
        (v) => (settings.tempo ?? 0) === v,
        (v) => update({ tempo: v }),
      ),
      el('p', { className: 'hint' }, ['Mit Limit hast du so viele Sekunden pro Land, danach kommt das nächste.']),
      card('Los geht’s', 'play', () => startRound(settings), 'primary', summary(settings, available)),
      el('button', { className: 'text-button', onclick: showStart }, ['Zurück']),
    ]),
  );
}

function recordText(entry: RecordEntry, endless: boolean): string {
  const score = endless ? `${entry.score} richtig` : `${entry.score} von ${entry.total}`;
  return `${score} · ${formatTime(entry.ms)}`;
}

function showStart() {
  const best = loadRecords(browserStore())[recordKey(rankedSettings(RANKED[0]))];
  app.replaceChildren(
    el('section', { className: 'screen start' }, [
      el('p', { className: 'kicker' }, ['Länderquiz']),
      el('h1', {}, ['Welches Land ist das?']),
      el('p', { className: 'lead' }, ['Erkennst du die Länder an ihrem Umriss?']),
      ...(best
        ? [el('p', { className: 'record' }, [el('span', {}, ['Dein Rekord · Rangliste Welt']), recordText(best, false)])]
        : []),
      map(),
      card('Rangliste', 'trophy', showRanked, 'primary highlight', 'Welt oder Kontinent · mit Bestenliste'),
      card('Freies Spiel', 'play', showSettings, 'secondary', summary(settings, pool(settings).length)),
      card('Freunde herausfordern', 'flag', () => showChallengeCreate(), 'secondary', 'Challenge per Link'),
      card('Bestenliste', 'list', () => showLeaderboard(), 'secondary'),
    ]),
  );
}

// Auswahl der Ranglisten-Runden
function showRanked() {
  const records = loadRecords(browserStore());
  app.replaceChildren(
    el('section', { className: 'screen ranked' }, [
      el('p', { className: 'kicker' }, ['Rangliste']),
      el('h1', {}, ['Wähle deine Rangliste']),
      el('p', { className: 'lead' }, ['Feste Runden im Modus Normal. Danach kannst du dich in die Bestenliste eintragen.']),
      ...RANKED.map((mode, i) => {
        const best = records[recordKey(rankedSettings(mode))];
        const sub = `${mode.length} Länder${best ? ` · Dein Rekord ${best.score}/${best.total}` : ''}`;
        return card(rankedLabel(mode), 'play', () => startRanked(mode), i === 0 ? 'primary' : 'secondary', sub);
      }),
      el('button', { className: 'text-button', onclick: showStart }, ['Zurück']),
    ]),
  );
}

const NAME_KEY = 'laenderquiz:name';

function rememberedName(): string {
  try {
    return browserStore()?.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

// Eintrag in die Bestenliste, nur nach einer Ranglisten-Runde
function leaderboardEntry(round: Round): HTMLElement {
  const mode = round.endless ? undefined : activeRanked;
  if (mode && round.hints > 0)
    return el('p', { className: 'hint center' }, ['Mit Hinweis gespielt, kein Eintrag in die Bestenliste.']);
  if (!mode || round.questions.length !== mode.length)
    return el('p', { className: 'hint center' }, ['In die Bestenliste kommen nur Ranglisten-Runden (Start → Rangliste).']);
  if (!plausible(round.score, round.totalMs, mode.length))
    return el('p', { className: 'hint center' }, ['Diese Runde war zu schnell für die Bestenliste.']);

  const input = el('input', {
    type: 'text',
    value: rememberedName(),
    maxLength: NAME_MAX * 2,
    placeholder: 'Dein Name',
    autocomplete: 'nickname' as AutoFill,
    ariaLabel: 'Name für die Bestenliste',
  });
  const message = el('p', { className: 'form-message', ariaLive: 'polite' });
  const box = el('div', { className: 'entry' });
  let sending = false;
  const send = async () => {
    if (sending) return;
    const check = checkName(input.value);
    if (!check.ok) {
      message.textContent = check.message;
      return;
    }
    sending = true;
    submit.disabled = true;
    message.textContent = 'Wird eingetragen …';
    try {
      const place = await submitEntry(
        { modus: mode.modus, name: check.name, richtige: round.score, zeit_ms: round.totalMs },
        mode.length,
      );
      try {
        browserStore()?.setItem(NAME_KEY, check.name);
      } catch {
        // ohne Speicher eben nicht merken
      }
      box.replaceChildren(
        el('p', { className: 'entry-done' }, [place > 0 ? `Eingetragen auf Platz ${place}!` : 'Eingetragen!']),
        card('Bestenliste ansehen', 'list', () => showLeaderboard(mode, check.name), 'secondary'),
      );
    } catch (e) {
      message.textContent = e instanceof LeaderboardError ? e.message : 'Das hat leider nicht geklappt.';
      submit.disabled = false;
      sending = false;
    }
  };
  const submit = card('Eintragen', 'check', send, 'secondary');
  input.onkeydown = (ev) => {
    if (ev.key === 'Enter') send();
  };
  box.append(el('label', { className: 'entry-label' }, ['In die Bestenliste eintragen', input]), message, submit);
  return box;
}

async function showLeaderboard(mode: RankedMode = RANKED[0], highlight?: string) {
  const list = el('ol', { className: 'board' });
  const status = el('p', { className: 'lead center' }, ['Lädt …']);
  app.replaceChildren(
    el('section', { className: 'screen leaderboard' }, [
      el('p', { className: 'kicker' }, ['Rangliste']),
      el('h1', {}, ['Bestenliste']),
      chips(
        RANKED.map((m) => ({ label: m.modus, value: m })),
        (m) => m === mode,
        (m) => showLeaderboard(m),
      ),
      el('p', { className: 'hint center' }, [`${rankedLabel(mode)} · ${mode.length} Länder · Normal`]),
      status,
      list,
      card(`${rankedLabel(mode)} spielen`, 'play', () => startRanked(mode), 'primary', `${mode.length} Länder · Normal`),
      card('Zurück zum Start', 'arrow', showStart, 'secondary'),
    ]),
  );
  try {
    const entries = await fetchTop(mode.modus, 20);
    if (!list.isConnected) return; // inzwischen anderer Reiter gewählt
    status.remove();
    if (entries.length === 0) {
      list.replaceWith(el('p', { className: 'lead center' }, ['Noch niemand eingetragen. Sei die oder der Erste!']));
      return;
    }
    let marked = false;
    list.append(
      ...entries.map((entry, i) => {
        const mine = !marked && entry.name === highlight;
        if (mine) marked = true;
        return el('li', { className: mine ? 'mine' : '' }, [
          el('span', { className: 'rank' }, [`${i + 1}.`]),
          el('span', { className: 'name' }, [entry.name]),
          el('span', { className: 'points' }, [`${entry.richtige}/${mode.length}`]),
          el('span', { className: 'ms' }, [formatTime(entry.zeit_ms)]),
        ]);
      }),
    );
  } catch (e) {
    status.textContent = e instanceof LeaderboardError ? e.message : 'Die Bestenliste konnte nicht geladen werden.';
  }
}

// Nach der Antwort: Umriss durch die Karte ersetzen (Land rot, falsche Wahl dunkel),
// dazu Größenvergleich mit Deutschland. Ohne Netz bleibt der Umriss stehen.
async function mountContext(stage: HTMLElement, shape: Element, question: Question, chosen: string | null, animate: boolean) {
  const c = question.country;
  if (!c.id || !c.center || c.radius === undefined) return;
  const picked = question.options.find((o) => o.code === chosen && o.code !== c.code);
  const wrong = picked ? { id: picked.id, center: picked.center, tiny: picked.tiny } : undefined;
  try {
    const map = await contextMap({ id: c.id, center: c.center, radius: c.radius, tiny: c.tiny, frame: c.frame, wrong });
    if (!shape.isConnected) return; // inzwischen weitergeklickt
    if (animate) map.classList.add('reveal');
    shape.replaceWith(map);
    if (animate) zoomOut(map, 500, 150);
    else map.querySelectorAll('.marker').forEach((m) => m.classList.remove('away'));
    enableGestures(map);
    if (map.dataset.ratio) {
      // Zahl immer, Deutschland-Silhouette nur auf Tipp, damit die Karte ruhig bleibt
      const compare = el('button', { className: 'size-compare', ariaLabel: 'Deutschland zum Vergleich einblenden' }, [
        germanyIcon(),
        sizeComparison(Number(map.dataset.ratio)),
      ]);
      compare.setAttribute('aria-pressed', 'false');
      compare.onclick = () => {
        const on = map.classList.toggle('compare');
        compare.setAttribute('aria-pressed', String(on));
      };
      stage.append(compare);
    }
  } catch {
    // ohne Netz bleibt einfach der Umriss stehen
  }
}

// Pause nach der Antwort im Tempo-Modus
const AUTO_NEXT_MS = 1500;

function showQuestion(round: Round) {
  if (isFinished(round)) return showResult(round);
  const question = currentQuestion(round)!;
  const feedback = el('p', { className: 'feedback', ariaLive: 'polite' });
  const shape = outline(question.country);
  // Nach der Antwort zoomt das Bild aus dem Umriss heraus auf die Region (Kontext zum Lernen).
  // Die Weltkarte wird schon jetzt im Hintergrund geladen.
  preloadWorld();
  const showContext = (chosen: string | null) => mountContext(stage, shape, question, chosen, true);
  const next = card('Weiter', 'arrow', () => {}, 'primary next');
  next.hidden = true;

  const buttons = question.options.map((option, i) =>
    card(option.name, 'ABCD'[i], () => choose(option.code), 'option'),
  );

  // Stand nach der Antwort, damit „Runde beenden“ die aktuelle Antwort mitzählt
  let latest = round;

  // Antwortzeit: läuft ab Anzeige der Frage bis zur Antwort, die Rückmeldung zählt nicht
  const clock = startQuestionClock(() => performance.now());

  // Hinweis: Flagge oben rechts in der Umriss-Karte. In Ranglisten-Runden erlaubt,
  // dann zählt die Runde aber nicht mehr für die Bestenliste.
  const ranked = round.endless ? undefined : activeRanked;
  let usedHint = false;
  const challenge = activeChallenge;
  const badge = el('p', { className: 'badge' }, [
    ranked ? `Rangliste · ${rankedLabel(ranked)}` : challenge ? `Challenge · ${challenge.challenge.titel}` : '',
  ]);
  const hintNote = el('p', { className: 'hint-note' }, ['Mit Hinweis, zählt nicht für die Bestenliste']);
  const showRankedState = (disqualified: boolean) => {
    // Platz behalten, damit beim Aufdecken nichts springt
    badge.hidden = !ranked && !challenge;
    badge.style.visibility = disqualified ? 'hidden' : '';
    hintNote.hidden = !ranked || !disqualified;
  };
  showRankedState(round.hints > 0);
  const flagButton = el('button', { className: 'flag-hint', ariaLabel: 'Flagge als Hinweis zeigen' }, [
    icon('flag'),
    'Flagge zeigen',
  ]);
  let flagShown = false;
  const showFlag = () => {
    const url = flagUrl(question.country.code);
    if (!url || flagShown) return;
    flagShown = true;
    const image = el('img', { className: 'flag-hint-image', src: url, alt: `Flagge von ${question.country.name}` });
    if (flagButton.isConnected) flagButton.replaceWith(image);
    else stage.append(image);
  };
  flagButton.onclick = () => {
    usedHint = true;
    showFlag();
    showRankedState(true);
  };
  // In Challenges gibt es keinen Hinweis, damit alle die gleichen Bedingungen haben
  const stage = el('div', { className: 'stage' }, challenge ? [shape] : [shape, flagButton]);

  // Tempo: Balken läuft ab, danach zählt die Frage als falsch
  const limitMs = (round.endless || activeRanked ? 0 : (active.tempo ?? 0)) * 1000;
  const countdown = el('div', { className: 'countdown', hidden: !limitMs });
  const countdownBar = el('div', { className: 'countdown-bar' });
  countdown.append(countdownBar);
  if (limitMs) countdownBar.style.animationDuration = `${limitMs}ms`;
  const timeout = limitMs ? setTimeout(() => stage.isConnected && choose(null), limitMs) : undefined;

  function choose(code: string | null) {
    clearTimeout(timeout);
    countdown.classList.add('stopped');
    if (!usedHint) flagButton.remove();
    const elapsed = code === null ? limitMs : Math.min(clock.elapsed(), limitMs || Infinity);
    const result = answerQuestion(round, code, elapsed, usedHint);
    latest = result.round;
    buttons.forEach((button, i) => {
      button.disabled = true;
      const optionCode = question.options[i].code;
      if (optionCode === result.correctCountry.code) button.classList.add('correct');
      else if (optionCode === code) button.classList.add('wrong');
    });
    feedback.textContent = result.correct
      ? 'Richtig!'
      : code === null
        ? `Zeit abgelaufen. Das war ${result.correctCountry.name}.`
        : `Leider falsch. Das war ${result.correctCountry.name}.`;
    feedback.className = `feedback ${result.correct ? 'good' : 'bad'}`;
    next.querySelector('.label')!.textContent = isFinished(result.round) ? 'Zum Ergebnis' : 'Weiter';
    next.onclick = () => showQuestion(result.round);
    next.hidden = false;
    showFlag();
    showContext(code);
    next.focus();
    // Mit Zeitlimit geht es nach kurzer Pause von selbst weiter
    if (limitMs) setTimeout(() => next.isConnected && next.click(), AUTO_NEXT_MS);
  }

  app.replaceChildren(
    el('section', { className: 'screen game' }, [
      badge,
      el('header', { className: 'status' }, [
        el('span', {}, [round.endless ? `Frage ${round.index + 1}` : `Frage ${round.index + 1} von ${round.questions.length}`]),
        el('span', {}, [`${round.score} richtig`]),
      ]),
      stage,
      countdown,
      hintNote,
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
  if (activeChallenge) return showChallengeResult(round, activeChallenge);
  const total = round.questions.length;
  const endless = round.endless === true;
  // Runden mit Hinweis verbessern den Rekord nicht, damit er vergleichbar bleibt
  let record: HTMLElement;
  if (round.hints > 0) {
    const best = loadRecords(browserStore())[recordKey(active)];
    record = el('p', { className: 'record' }, [
      el('span', {}, ['Mit Hinweis, zählt nicht als Rekord']),
      best ? `Dein Rekord: ${recordText(best, endless)}` : 'Noch kein Rekord',
    ]);
  } else {
    const update = submitResult(browserStore(), recordKey(active), { score: round.score, total, ms: round.totalMs });
    record = update.isNew
      ? el('p', { className: 'record new' }, [
          el('span', {}, [update.previous ? 'Neuer Rekord!' : 'Dein erster Rekord']),
          update.previous ? `Bisher: ${recordText(update.previous, endless)}` : summary(active, pool(active).length),
        ])
      : el('p', { className: 'record' }, [el('span', {}, ['Dein Rekord']), recordText(update.best, endless)]);
  }
  const entry = leaderboardEntry(round);
  // Durchsicht kehrt zu genau diesem Bildschirm zurück (Rekord wird nicht erneut gewertet)
  const back = () => app.replaceChildren(screen);
  const screen = el('section', { className: 'screen result' }, [
    el('p', { className: 'kicker' }, ['Ergebnis']),
    el('h1', {}, ['Geschafft!']),
    el('p', { className: 'score' }, [`${round.score} von ${total}`]),
    el('p', { className: 'lead' }, [
      (round.score === total ? 'Perfekt, alle richtig!' : 'Länder richtig erkannt') +
        (round.hints > 0 ? ` · ${round.hints} mit Hinweis` : ''),
    ]),
    el('p', { className: 'time' }, [`Zeit: ${formatTime(round.totalMs)}`]),
    record,
    entry,
    // Auf kleinen Displays ist neben dem Eintragsfeld kein Platz für die Karte
    ...(entry.classList.contains('entry') ? [] : [map()]),
    card('Neue Runde', 'again', newRound, 'primary', summary(active, pool(active).length)),
    ...(round.answers.length > 0
      ? [card('Antworten durchgehen', 'list', () => showReview(round, 0, back), 'secondary', 'Karte, Flagge und deine Antwort')]
      : []),
    activeRanked
      ? card('Andere Rangliste', 'trophy', showRanked, 'secondary')
      : card('Einstellungen', 'settings', showSettings, 'secondary'),
    card('Freunde herausfordern', 'flag', () => showChallengeCreate(active), 'secondary', 'Challenge mit diesen Einstellungen'),
  ]);
  app.replaceChildren(screen);
}

// Durchsicht: jede Frage noch einmal mit Karte, Flagge und eigener Antwort, in Ruhe
function showReview(round: Round, i: number, back: () => void) {
  const question = round.questions[i];
  const chosen = round.answers[i] ?? null;
  const correct = chosen === question.country.code;
  const total = round.answers.length;
  const shape = outline(question.country);
  const url = flagUrl(question.country.code);
  const stage = el('div', { className: 'stage' }, [
    shape,
    ...(url ? [el('img', { className: 'flag-hint-image', src: url, alt: `Flagge von ${question.country.name}` })] : []),
  ]);
  mountContext(stage, shape, question, chosen, false);
  const picked = question.options.find((o) => o.code === chosen);
  const yours = chosen === null ? 'Zeit abgelaufen' : (picked?.name ?? '');
  const prev = el('button', { className: 'chip', disabled: i === 0, onclick: () => showReview(round, i - 1, back) }, ['‹ Zurück']);
  const next =
    i + 1 < total
      ? card('Nächstes Land', 'arrow', () => showReview(round, i + 1, back), 'primary next')
      : card('Zum Ergebnis', 'arrow', back, 'primary next');
  app.replaceChildren(
    el('section', { className: 'screen game review' }, [
      el('header', { className: 'status' }, [
        el('span', {}, [`Durchsicht · ${i + 1} von ${total}`]),
        el('span', { className: correct ? 'good' : 'bad' }, [correct ? 'Richtig' : 'Falsch']),
      ]),
      stage,
      el('div', { className: 'review-answer' }, [
        el('p', { className: 'review-country' }, [question.country.name]),
        ...(correct
          ? []
          : [el('p', { className: 'review-yours' }, chosen === null ? [yours] : ['Deine Antwort: ', el('s', {}, [yours])])]),
      ]),
      next,
      el('div', { className: 'review-nav' }, [
        prev,
        el('button', { className: 'text-button', onclick: back }, ['Zum Ergebnis']),
      ]),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Challenges per Link
// ---------------------------------------------------------------------------

const challengeLink = (id: string) => `${location.origin}${location.pathname}?c=${id}`;

function rememberName(name: string) {
  try {
    browserStore()?.setItem(NAME_KEY, name);
  } catch {
    // ohne Speicher eben nicht merken
  }
}

function textInput(value: string, placeholder: string, label: string, max: number) {
  return el('input', { type: 'text', value, maxLength: max * 2, placeholder, ariaLabel: label });
}

// Challenge anlegen, optional mit den Einstellungen der gerade gespielten Runde
function showChallengeCreate(from?: Settings) {
  const setup = {
    region: from?.continent ?? 'Welt',
    laender: CHALLENGE_LENGTHS.reduce((best, n) =>
      typeof from?.length === 'number' && Math.abs(n - from.length) < Math.abs(best - from.length) ? n : best,
    10 as number),
    tempo: from?.tempo ?? 0,
    gleich: true,
    versuche: 1 as number,
  };
  const title = textInput('Länder-Challenge', 'Name der Challenge', 'Name der Challenge', TITLE_MAX);
  const name = textInput(rememberedName(), 'Dein Name', 'Dein Name', NAME_MAX);
  const message = el('p', { className: 'form-message', ariaLive: 'polite' });
  const choices = el('div', { className: 'challenge-choices' });
  const render = () =>
    choices.replaceChildren(
      el('h2', {}, ['Region']),
      chips(
        CONTINENTS.map((c) => ({ label: c === 'Welt' ? 'Ganze Welt' : c, value: c })),
        (v) => setup.region === v,
        (v) => ((setup.region = v), render()),
      ),
      el('h2', {}, ['Anzahl Länder']),
      chips(
        CHALLENGE_LENGTHS.map((n) => ({ label: String(n), value: n as number })),
        (v) => setup.laender === v,
        (v) => ((setup.laender = v), render()),
      ),
      el('h2', {}, ['Tempo']),
      chips(
        TEMPOS.map((t) => ({ label: t === 0 ? 'Ohne Limit' : `${t} s`, value: t })),
        (v) => setup.tempo === v,
        (v) => ((setup.tempo = v), render()),
      ),
      el('h2', {}, ['Länder']),
      chips(
        [
          { label: 'Gleich für alle', value: true },
          { label: 'Zufällig', value: false },
        ],
        (v) => setup.gleich === v,
        (v) => ((setup.gleich = v), render()),
      ),
      el('h2', {}, ['Versuche']),
      chips(
        CHALLENGE_ATTEMPTS.map((n) => ({ label: String(n), value: n as number })),
        (v) => setup.versuche === v,
        (v) => ((setup.versuche = v), render()),
      ),
      el('p', { className: 'hint' }, [
        setup.gleich
          ? 'Alle bekommen dieselben Länder und Antworten, nur in anderer Reihenfolge. Bei mehreren Versuchen hat jeder Versuch eigene Länder, für alle gleich.'
          : 'Jede Runde zieht die Länder neu aus der Region.',
      ]),
    );
  render();

  let sending = false;
  const create = async () => {
    if (sending) return;
    const t = checkName(title.value, TITLE_MAX, 'Namen für die Challenge');
    const n = checkName(name.value);
    if (!t.ok) return void (message.textContent = t.message);
    if (!n.ok) return void (message.textContent = n.message);
    sending = true;
    message.textContent = 'Wird angelegt …';
    const challengeSetup: ChallengeSetup = {
      titel: t.name,
      ersteller: n.name,
      region: setup.region,
      laender: setup.laender,
      tempo: setup.tempo,
      versuche: setup.versuche,
      fragen: setup.gleich
        ? fixQuestions(pool(challengeSettings({ region: setup.region, laender: setup.laender, tempo: setup.tempo })), setup.laender, setup.versuche)
        : null,
    };
    try {
      const challenge = await createChallenge(challengeSetup);
      rememberName(n.name);
      showChallengeCreated(challenge);
    } catch (e) {
      message.textContent = e instanceof LeaderboardError ? e.message : 'Das hat leider nicht geklappt.';
      sending = false;
    }
  };

  app.replaceChildren(
    el('section', { className: 'screen settings challenge-create' }, [
      el('p', { className: 'kicker' }, ['Challenge']),
      el('h1', {}, ['Freunde herausfordern']),
      el('div', { className: 'entry' }, [
        el('label', { className: 'entry-label' }, ['Name der Challenge', title]),
        el('label', { className: 'entry-label' }, ['Dein Name', name]),
      ]),
      choices,
      message,
      card('Challenge erstellen', 'flag', create, 'primary', 'Danach bekommst du den Link'),
      el('button', { className: 'text-button', onclick: showStart }, ['Zurück']),
    ]),
  );
}

async function shareChallenge(challenge: Challenge, status: HTMLElement) {
  const url = challengeLink(challenge.id);
  const text = `${challenge.ersteller} fordert dich heraus: ${challenge.titel} im Länderquiz. Erkennst du die Länder am Umriss?`;
  try {
    if (navigator.share) {
      await navigator.share({ title: challenge.titel, text, url });
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return; // Teilen abgebrochen
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    status.textContent = 'Link kopiert. Füge ihn in WhatsApp oder eine Mail ein.';
  } catch {
    status.textContent = 'Kopieren ging nicht. Markiere den Link oben und kopiere ihn.';
  }
}

function showChallengeCreated(challenge: Challenge) {
  const status = el('p', { className: 'form-message center', ariaLive: 'polite' });
  const link = el('input', { type: 'text', value: challengeLink(challenge.id), readOnly: true, ariaLabel: 'Link zur Challenge' });
  link.onfocus = () => link.select();
  history.replaceState(null, '', `?c=${challenge.id}`);
  app.replaceChildren(
    el('section', { className: 'screen challenge' }, [
      el('p', { className: 'kicker' }, ['Challenge erstellt']),
      el('h1', {}, [challenge.titel]),
      el('ul', { className: 'conditions' }, conditions(challenge).map((c) => el('li', {}, [c]))),
      el('div', { className: 'entry' }, [link]),
      card('Link teilen', 'arrow', () => shareChallenge(challenge, status), 'primary', 'WhatsApp, Mail oder kopieren'),
      status,
      card('Selbst spielen', 'play', () => showChallengeInvite(challenge), 'secondary'),
      el('button', { className: 'text-button', onclick: leaveChallenge }, ['Zum Start']),
    ]),
  );
}

function leaveChallenge() {
  history.replaceState(null, '', location.pathname);
  showStart();
}

async function openChallenge(id: string) {
  app.replaceChildren(el('section', { className: 'screen challenge' }, [el('p', { className: 'lead center' }, ['Challenge wird geladen …'])]));
  try {
    const challenge = await fetchChallenge(id);
    if (challenge) return showChallengeInvite(challenge);
    app.replaceChildren(
      el('section', { className: 'screen challenge' }, [
        el('h1', {}, ['Challenge nicht gefunden']),
        el('p', { className: 'lead' }, ['Der Link ist unvollständig oder die Challenge wurde gelöscht.']),
        card('Zum Start', 'arrow', leaveChallenge, 'primary'),
      ]),
    );
  } catch (e) {
    app.replaceChildren(
      el('section', { className: 'screen challenge' }, [
        el('h1', {}, ['Gerade nicht erreichbar']),
        el('p', { className: 'lead' }, [e instanceof LeaderboardError ? e.message : 'Die Challenge konnte nicht geladen werden.']),
        card('Nochmal versuchen', 'again', () => openChallenge(id), 'primary'),
        el('button', { className: 'text-button', onclick: leaveChallenge }, ['Zum Start']),
      ]),
    );
  }
}

// Einladung: wer fordert heraus, unter welchen Bedingungen, wie viele Versuche sind übrig
function showChallengeInvite(challenge: Challenge) {
  history.replaceState(null, '', `?c=${challenge.id}`);
  const used = attemptsUsed(browserStore(), challenge.id);
  const left = challenge.versuche - used;
  const name = textInput(rememberedName(), 'Dein Name', 'Dein Name für die Rangliste', NAME_MAX);
  const message = el('p', { className: 'form-message', ariaLive: 'polite' });
  const start = () => {
    const n = checkName(name.value);
    if (!n.ok) return void (message.textContent = n.message);
    rememberName(n.name);
    startChallenge(challenge, n.name);
  };
  name.onkeydown = (ev) => {
    if (ev.key === 'Enter') start();
  };
  app.replaceChildren(
    el('section', { className: 'screen challenge' }, [
      el('p', { className: 'kicker' }, ['Challenge']),
      el('h1', {}, [`${challenge.ersteller} fordert dich heraus`]),
      el('p', { className: 'lead' }, [challenge.titel]),
      el('ul', { className: 'conditions' }, conditions(challenge).map((c) => el('li', {}, [c]))),
      ...(left > 0
        ? [
            el('div', { className: 'entry' }, [el('label', { className: 'entry-label' }, ['Dein Name', name]), message]),
            card(
              used === 0 ? 'Los geht’s' : `Versuch ${used + 1} von ${challenge.versuche}`,
              'play',
              start,
              'primary',
              left === 1 ? 'Dein letzter Versuch' : `Noch ${left} Versuche`,
            ),
          ]
        : [el('p', { className: 'hint center' }, ['Du hast alle Versuche gespielt.'])]),
      card('Rangliste ansehen', 'list', () => showChallengeBoard(challenge), 'secondary'),
      el('button', { className: 'text-button', onclick: leaveChallenge }, ['Zum Start']),
    ]),
  );
}

function startChallenge(challenge: Challenge, name: string) {
  const attempt = useAttempt(browserStore(), challenge.id);
  active = challengeSettings(challenge);
  activeRanked = undefined;
  activeChallenge = { challenge, attempt, name };
  showQuestion(challengeRound(challenge, attempt, allCountries));
}

function showChallengeResult(round: Round, current: NonNullable<typeof activeChallenge>) {
  const { challenge, attempt, name } = current;
  const total = round.questions.length;
  const left = challenge.versuche - attemptsUsed(browserStore(), challenge.id);
  const status = el('p', { className: 'form-message center', ariaLive: 'polite' }, ['Ergebnis wird eingetragen …']);
  const back = () => app.replaceChildren(screen);
  const screen = el('section', { className: 'screen result' }, [
    el('p', { className: 'kicker' }, [`Challenge · ${challenge.titel}`]),
    el('h1', {}, ['Geschafft!']),
    el('p', { className: 'score' }, [`${round.score} von ${total}`]),
    el('p', { className: 'time' }, [`Zeit: ${formatTime(round.totalMs)}`]),
    status,
    card('Rangliste der Challenge', 'list', () => showChallengeBoard(challenge, back), 'primary'),
    card('Antworten durchgehen', 'list', () => showReview(round, 0, back), 'secondary', 'Karte, Flagge und deine Antwort'),
    ...(left > 0
      ? [card('Nächster Versuch', 'again', () => startChallenge(challenge, name), 'secondary', left === 1 ? 'Dein letzter Versuch' : `Noch ${left} Versuche`)]
      : []),
    card('Challenge teilen', 'flag', () => shareChallenge(challenge, status), 'secondary'),
    card('Frei weiterspielen', 'play', () => {
      settings = { ...challengeSettings(challenge) };
      saveSettings(settings);
      history.replaceState(null, '', location.pathname);
      showSettings();
    }, 'secondary', 'Gleiche Einstellungen im freien Spiel'),
  ]);
  app.replaceChildren(screen);
  submitChallengeResult({
    challenge_id: challenge.id,
    spieler: playerId(browserStore()),
    name,
    versuch: attempt,
    richtige: round.score,
    zeit_ms: round.totalMs,
  })
    .then(() => (status.textContent = 'Eingetragen!'))
    .catch((e) => (status.textContent = e instanceof LeaderboardError ? e.message : 'Eintragen hat nicht geklappt.'));
}

async function showChallengeBoard(challenge: Challenge, back?: () => void) {
  const list = el('ol', { className: 'board' });
  const status = el('p', { className: 'lead center' }, ['Lädt …']);
  const me = playerId(browserStore());
  app.replaceChildren(
    el('section', { className: 'screen leaderboard' }, [
      el('p', { className: 'kicker' }, ['Challenge']),
      el('h1', {}, [challenge.titel]),
      el('p', { className: 'lead' }, [`von ${challenge.ersteller} · ${conditions(challenge).slice(0, 2).join(' · ')}`]),
      status,
      list,
      card('Challenge teilen', 'flag', () => shareChallenge(challenge, status), 'secondary'),
      back
        ? el('button', { className: 'text-button', onclick: back }, ['Zurück'])
        : el('button', { className: 'text-button', onclick: () => showChallengeInvite(challenge) }, ['Zurück']),
    ]),
  );
  try {
    const entries = await fetchChallengeResults(challenge.id);
    status.remove();
    if (entries.length === 0) {
      list.replaceWith(el('p', { className: 'lead center' }, ['Noch niemand hat gespielt.']));
      return;
    }
    list.append(
      ...entries.map((entry, i) =>
        el('li', { className: entry.spieler === me ? 'mine' : '' }, [
          el('span', { className: 'rank' }, [`${i + 1}.`]),
          el('span', { className: 'name' }, [entry.name]),
          el('span', { className: 'points' }, [`${entry.richtige}/${challenge.laender}`]),
          el('span', { className: 'ms' }, [formatTime(entry.zeit_ms)]),
        ]),
      ),
    );
  } catch (e) {
    status.textContent = e instanceof LeaderboardError ? e.message : 'Die Rangliste konnte nicht geladen werden.';
  }
}

// Einstieg: mit ?c=… direkt zur Challenge, sonst Startbildschirm
const challengeId = new URLSearchParams(location.search).get('c');
if (challengeId) openChallenge(challengeId);
else showStart();
