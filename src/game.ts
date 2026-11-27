export interface Country {
  code: string;
  name: string;
  path: string;
  continent?: string;
  subregion?: string;
  tiny?: boolean;
}

export interface Question {
  country: Country;
  options: Country[];
}

export interface Round {
  questions: Question[];
  index: number;
  score: number;
}

export interface RoundSettings {
  length: number;
}

export type Rng = () => number;

export interface AnswerResult {
  round: Round;
  correct: boolean;
  correctCountry: Country;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const OPTION_COUNT = 4;

// Falsche Antworten bevorzugt aus derselben Teilregion, dann vom selben
// Kontinent, dann aus aller Welt. So ist die Frage nicht zu leicht.
function pickDistractors(country: Country, pool: Country[], rng: Rng): Country[] {
  const others = shuffle(
    pool.filter((c) => c.code !== country.code),
    rng,
  );
  const tiers = [
    others.filter((c) => c.subregion !== undefined && c.subregion === country.subregion),
    others.filter((c) => c.continent !== undefined && c.continent === country.continent && c.subregion !== country.subregion),
    others.filter((c) => c.continent === undefined || c.continent !== country.continent),
  ];
  return tiers.flat().slice(0, OPTION_COUNT - 1);
}

export function createRound(countries: Country[], settings: RoundSettings, rng: Rng = Math.random): Round {
  const length = Math.max(1, Math.min(settings.length, countries.length));
  const picked = shuffle(countries, rng).slice(0, length);
  const questions = picked.map((country) => {
    const distractors = pickDistractors(country, countries, rng);
    return { country, options: shuffle([country, ...distractors], rng) };
  });
  return { questions, index: 0, score: 0 };
}

export function currentQuestion(round: Round): Question | undefined {
  return round.questions[round.index];
}

export function isFinished(round: Round): boolean {
  return round.index >= round.questions.length;
}

export function answerQuestion(round: Round, code: string): AnswerResult {
  const question = currentQuestion(round);
  if (!question) throw new Error('Runde ist bereits beendet');
  const correct = code === question.country.code;
  return {
    correct,
    correctCountry: question.country,
    round: { ...round, index: round.index + 1, score: round.score + (correct ? 1 : 0) },
  };
}
