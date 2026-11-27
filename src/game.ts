export interface Country {
  code: string;
  name: string;
  path: string;
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

export function createRound(countries: Country[], settings: RoundSettings, rng: Rng = Math.random): Round {
  const length = Math.max(1, Math.min(settings.length, countries.length));
  const picked = shuffle(countries, rng).slice(0, length);
  const questions = picked.map((country) => {
    const distractors = shuffle(
      countries.filter((c) => c.code !== country.code),
      rng,
    ).slice(0, OPTION_COUNT - 1);
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
