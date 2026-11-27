// Zeitmessung pro Frage. Die Uhr ist austauschbar, damit sich das Verhalten
// mit einer gefakten Uhr testen lässt.
export type Clock = () => number;

export interface QuestionClock {
  // vergangene Zeit seit Fragebeginn
  elapsed(): number;
}

export function startQuestionClock(now: Clock): QuestionClock {
  const start = now();
  return { elapsed: () => Math.max(0, now() - start) };
}

// Gesamtzeit für den Ergebnis-Bildschirm, z. B. „42,3 s“ oder „1:05,0 min“
export function formatTime(ms: number): string {
  const tenths = Math.round(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  const s = seconds.toFixed(1).replace('.', ',');
  return minutes === 0 ? `${s} s` : `${minutes}:${s.padStart(4, '0')} min`;
}
