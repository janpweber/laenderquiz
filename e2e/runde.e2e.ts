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
  await expect(page.locator('.badge')).toHaveCount(0);
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
