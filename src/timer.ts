// Zeitmessung pro Frage. Die Uhr ist austauschbar, damit sich das Verhalten
// mit einer gefakten Uhr testen lässt.
export type Clock = () => number;

export interface QuestionClock {
  // vergangene Zeit seit Fragebeginn, ohne Pausen
  elapsed(): number;
  // z. B. während der Rückfrage beim Abbrechen einer Challenge
  pause(): void;
  resume(): void;
}

export function startQuestionClock(now: Clock): QuestionClock {
  const start = now();
  let paused = 0;
  let pausedAt: number | null = null;
  return {
    elapsed: () => Math.max(0, (pausedAt ?? now()) - start - paused),
    pause: () => {
      if (pausedAt === null) pausedAt = now();
    },
    resume: () => {
      if (pausedAt === null) return;
      paused += now() - pausedAt;
      pausedAt = null;
    },
  };
}

// Gesamtzeit für den Ergebnis-Bildschirm, z. B. „42,3 s“ oder „1:05,0 min“
export function formatTime(ms: number): string {
  const tenths = Math.round(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  const s = seconds.toFixed(1).replace('.', ',');
  return minutes === 0 ? `${s} s` : `${minutes}:${s.padStart(4, '0')} min`;
}
