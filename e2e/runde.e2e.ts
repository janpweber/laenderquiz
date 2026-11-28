import { expect, test, type Page } from '@playwright/test';

interface Row {
  modus: string;
  name: string;
  richtige: number;
  zeit_ms: number;
  created_at?: string;
}

// Supabase-REST nachbauen: Einträge landen in einer Liste im Test
async function fakeSupabase(page: Page) {
  const rows: Row[] = [{ modus: 'Welt', name: 'Kollegin A', richtige: 9, zeit_ms: 41_000, created_at: '2026-11-01' }];
  const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range' };
  await page.route('**/rest/v1/bestenliste**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST') {
      rows.push({ ...(request.postDataJSON() as Row), created_at: new Date().toISOString() });
      return route.fulfill({ status: 201, headers: cors, body: '' });
    }
    const modus = decodeURIComponent(url.searchParams.get('modus')?.replace(/^eq\./, '') ?? '');
    const mine = rows.filter((r) => r.modus === modus);
    if (request.method() === 'HEAD') {
      const last = rows[rows.length - 1];
      const better = mine.filter((r) => r.richtige > last.richtige || (r.richtige === last.richtige && r.zeit_ms < last.zeit_ms));
      return route.fulfill({ status: 200, headers: { ...cors, 'content-range': `*/${better.length}` }, body: '' });
    }
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(mine) });
  });
  return rows;
}

async function answerAll(page: Page, count: number) {
  for (let i = 1; i <= count; i++) {
    await expect(page.locator('.status')).toContainText(`Frage ${i}`);
    // kurz „nachdenken“, damit die Runde nicht als zu schnell gilt
    await page.waitForTimeout(350);
    await page.locator('.option').first().click();
    await expect(page.locator('.feedback')).not.toBeEmpty();
    await page.locator('.next').click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Ranglisten-Runde Welt durchspielen und eintragen', async ({ page }) => {
  const rows = await fakeSupabase(page);
  await page.locator('.card', { hasText: 'Rangliste' }).click();
  await page.locator('.card', { hasText: 'Ganze Welt' }).click();
  await expect(page.locator('.badge')).toHaveText(/Rangliste · Ganze Welt/i);
  await answerAll(page, 10);

  await expect(page.locator('.score')).toContainText('von 10');
  await expect(page.locator('.time')).toContainText('Zeit:');
  await expect(page.locator('.record')).toBeVisible();

  // gesperrter Name wird schon im Browser abgelehnt
  await page.locator('.entry input').fill('F.u.c.k');
  await page.locator('.entry .card').click();
  await expect(page.locator('.form-message')).toContainText('anderen');
  expect(rows).toHaveLength(1);

  await page.locator('.entry input').fill('  Jan  ');
  await page.locator('.entry .card').click();
  await expect(page.locator('.entry-done')).toContainText('Platz 2');
  expect(rows[1]).toMatchObject({ modus: 'Welt', name: 'Jan' });

  await page.locator('.card', { hasText: 'Bestenliste ansehen' }).click();
  await expect(page.locator('.board li')).toHaveCount(2);
  await expect(page.locator('.board li.mine')).toContainText('Jan');

  // Rekord bleibt nach dem Neuladen
  await page.reload();
  await expect(page.locator('.start .record')).toContainText('von 10');
});

test('Kontinent-Runde hat 5 Fragen und eigene Bestenliste', async ({ page }) => {
  await fakeSupabase(page);
  await page.locator('.card', { hasText: 'Rangliste' }).click();
  await page.locator('.card', { hasText: 'Europa' }).click();
  await answerAll(page, 5);
  await expect(page.locator('.score')).toContainText('von 5');
  await page.locator('.entry input').fill('Anna');
  await page.locator('.entry .card').click();
  await expect(page.locator('.entry-done')).toContainText('Platz 1');
  await page.locator('.card', { hasText: 'Bestenliste ansehen' }).click();
  await expect(page.locator('.chip.selected')).toHaveText(/Europa/i);
  await expect(page.locator('.board li')).toHaveCount(1);
});

test('ohne Netz bleibt das Spiel spielbar', async ({ page }) => {
  await page.route('**/rest/v1/**', (route) => route.abort('internetdisconnected'));
  await page.locator('.card', { hasText: 'Bestenliste' }).last().click();
  await expect(page.locator('.leaderboard')).toContainText('Keine Verbindung');
  await page.locator('.card', { hasText: 'Ganze Welt spielen' }).click();
  await answerAll(page, 10);
  await page.locator('.entry input').fill('Jan');
  await page.locator('.entry .card').click();
  await expect(page.locator('.form-message')).toContainText('Keine Verbindung');
  // weiterspielen geht
  await page.locator('.card', { hasText: 'Neue Runde' }).click();
  await expect(page.locator('.status')).toContainText('Frage 1 von 10');
});

test('freies Spiel endlos lässt sich jederzeit beenden', async ({ page }) => {
  await page.locator('.card', { hasText: 'Freies Spiel' }).click();
  await page.locator('.chip', { hasText: 'Endlos' }).click();
  await page.locator('.card', { hasText: 'Los geht' }).click();
  await expect(page.locator('.badge')).toBeHidden();
  await answerAll(page, 3);
  await page.locator('.option').first().click();
  await page.getByRole('button', { name: 'Runde beenden' }).click();
  await expect(page.locator('.score')).toContainText('von 4');
  await expect(page.locator('.result')).toContainText('nur Ranglisten-Runden');
});

test('Vorschau für WhatsApp ist vollständig', async ({ page, request }) => {
  const og = (p: string) => page.locator(`meta[property="og:${p}"]`).getAttribute('content');
  expect(await og('title')).toContain('Länderquiz');
  expect(await og('description')).toBeTruthy();
  const image = await og('image');
  expect(image).toMatch(/^https:\/\//);
  // das Bild liegt im Build
  const local = await request.get(new URL(image!).pathname.replace('/laenderquiz/', '/'));
  expect(local.status()).toBe(200);
  expect(local.headers()['content-type']).toContain('image/png');
});

test('Flaggen-Hinweis: in der Rangliste erlaubt, dann ohne Bestenliste', async ({ page }) => {
  await fakeSupabase(page);
  await page.locator('.card', { hasText: 'Rangliste' }).click();
  await page.locator('.card', { hasText: 'Europa' }).click();
  await expect(page.locator('.badge')).toBeVisible();
  await page.locator('.flag-hint').click();
  const flag = page.locator('.flag-hint-image');
  await expect(flag).toBeVisible();
  // Flagge ist geladen (echtes Bild, nicht leer)
  await expect.poll(() => flag.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.badge')).toBeHidden();
  await expect(page.locator('.hint-note')).toBeVisible();
  await answerAll(page, 5);
  await expect(page.locator('.result .lead')).toContainText('1 mit Hinweis');
  await expect(page.locator('.result')).toContainText('kein Eintrag in die Bestenliste');
  await expect(page.locator('.entry input')).toHaveCount(0);
});

test('freies Spiel zählt nie für die Bestenliste, auch mit Ranglisten-Einstellungen', async ({ page }) => {
  // Standard im freien Spiel: 10 Länder · Welt · Normal, also wie die Welt-Rangliste
  await page.locator('.card', { hasText: 'Freies Spiel' }).click();
  await page.locator('.card', { hasText: 'Los geht' }).click();
  await expect(page.locator('.badge')).toBeHidden();
  await page.locator('.flag-hint').click();
  await expect(page.locator('.flag-hint-image')).toBeVisible();
  await expect(page.locator('.hint-note')).toBeHidden();
  await answerAll(page, 10);
  await expect(page.locator('.result')).toContainText('nur Ranglisten-Runden');
  await expect(page.locator('.entry input')).toHaveCount(0);
});

test('nach der Antwort: Flagge und Karte erscheinen von selbst, ohne als Hinweis zu zählen', async ({ page }) => {
  await page.locator('.card', { hasText: 'Rangliste' }).click();
  await page.locator('.card', { hasText: 'Europa' }).click();
  await expect(page.locator('.outline')).toBeVisible();
  await page.locator('.option').first().click();
  await expect(page.locator('.flag-hint')).toHaveCount(0);
  await expect(page.locator('.flag-hint-image')).toBeVisible();
  await expect(page.locator('.context-map')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auf der Karte zeigen' })).toHaveCount(0);
  await expect(page.locator('.badge')).toBeVisible();
  await expect(page.locator('.hint-note')).toBeHidden();
});

test('falsche Antwort: das gewählte Land ist auf der Karte dunkel markiert, Karte lässt sich zoomen', async ({ page }) => {
  await page.locator('.card', { hasText: 'Rangliste' }).click();
  await page.locator('.card', { hasText: 'Europa' }).click();
  // so lange antworten, bis eine Antwort falsch ist
  for (let i = 0; i < 5; i++) {
    await page.locator('.option').nth(1).click();
    await expect(page.locator('.context-map')).toBeVisible();
    if ((await page.locator('.option.wrong').count()) > 0) break;
    await expect(page.locator('.context-map .wrong')).toHaveCount(0);
    await page.locator('.next').click();
  }
  await expect(page.locator('.context-map .wrong')).toHaveCount(1);
  // nach dem Zoom per Mausrad hineinzoomen: der Ausschnitt wird kleiner
  await page.waitForTimeout(900);
  const map = page.locator('.context-map');
  const width = async () => Number((await map.getAttribute('viewBox'))!.split(' ')[2]);
  const before = await width();
  await map.hover();
  await page.mouse.wheel(0, -300);
  expect(await width()).toBeLessThan(before);
  // näher als der Umriss am Anfang geht es nicht
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -300);
  const closest = await width();
  await page.mouse.wheel(0, -300);
  expect(await width()).toBeCloseTo(closest, 3);
  expect(closest).toBeGreaterThan(50);
});

test('Größenvergleich: Zahl steht da, Deutschland erscheint erst auf Tipp', async ({ page }) => {
  await page.locator('.card', { hasText: 'Rangliste' }).click();
  await page.locator('.card', { hasText: 'Welt' }).click();
  // Deutschland selbst hat keinen Vergleich: notfalls weiterklicken
  for (let i = 0; i < 3; i++) {
    await page.locator('.option').first().click();
    await expect(page.locator('.context-map')).toBeVisible();
    if ((await page.locator('.size-compare').count()) > 0) break;
    await page.locator('.next').click();
  }
  const compare = page.locator('.size-compare');
  await expect(compare).toContainText('Deutschland');
  await expect(page.locator('.context-map')).not.toHaveClass(/compare/);
  await compare.click();
  await expect(page.locator('.context-map')).toHaveClass(/compare/);
  await expect(compare).toHaveAttribute('aria-pressed', 'true');
});

test('Tempo: Zeit läuft ab, es geht von selbst weiter, danach Antworten durchgehen', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem('laenderquiz:einstellungen', JSON.stringify({ length: 2, continent: 'Europa', difficulty: 'normal', tempo: 2 })),
  );
  await page.reload();
  await page.locator('.card', { hasText: 'Freies Spiel' }).click();
  await expect(page.getByRole('button', { name: '2 s', exact: true })).toHaveClass(/selected/);
  await page.locator('.card', { hasText: 'Los geht' }).click();
  await expect(page.locator('.countdown')).toBeVisible();
  // nichts tippen: nach 2 s ist die Zeit um
  await expect(page.locator('.feedback')).toContainText('Zeit abgelaufen', { timeout: 4000 });
  // nach kurzer Pause kommt Frage 2 von selbst
  await expect(page.locator('.status')).toContainText('Frage 2', { timeout: 4000 });
  await page.locator('.option').first().click();
  await expect(page.locator('h1')).toHaveText('Geschafft!', { timeout: 4000 });
  await page.locator('.card', { hasText: 'Antworten durchgehen' }).click();
  await expect(page.locator('.status')).toContainText('Durchsicht · 1 von 2');
  await expect(page.locator('.review-yours')).toHaveText('Zeit abgelaufen');
  await page.getByRole('button', { name: 'Nächstes Land ›' }).click();
  await expect(page.locator('.status')).toContainText('2 von 2');
  await expect(page.getByRole('button', { name: '‹ Vorheriges Land' })).toBeEnabled();
  await page.getByRole('button', { name: 'Zum Ergebnis ›' }).click();
  // zurück auf Geschafft: Bild setzt sich nur zusammen, ohne Explosion
  await expect(page.locator('.region-art')).toHaveClass(/assemble/);
  await expect(page.locator('h1')).toHaveText('Geschafft!');
});
