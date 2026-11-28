import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// Supabase-Tabellen für Challenges nachbauen, gemeinsam für mehrere Browser
function fakeChallenges() {
  const challenges: Record<string, unknown>[] = [];
  const results: Record<string, unknown>[] = [];
  const cors = { 'access-control-allow-origin': '*' };
  // PostgREST-Filter wie id=eq.x, id=in.(a,b) nachbilden
  const filter = (rows: Record<string, unknown>[], url: string) => {
    const params = new URL(url).searchParams;
    return rows.filter((row) =>
      [...params].every(([key, value]) => {
        if (['select', 'limit', 'order'].includes(key)) return true;
        if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
        if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]));
        return true;
      }),
    );
  };
  const install = async (context: BrowserContext) => {
    await context.route('**/rest/v1/challenges**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        challenges.push(request.postDataJSON());
        return route.fulfill({ status: 201, headers: cors, body: '' });
      }
      const body = JSON.stringify(filter(challenges, request.url()));
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body });
    });
    await context.route('**/rest/v1/challenge_ergebnisse**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        results.push({ ...request.postDataJSON(), created_at: new Date().toISOString() });
        return route.fulfill({ status: 201, headers: cors, body: '' });
      }
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(filter(results, request.url())) });
    });
  };
  return { challenges, results, install };
}

async function play(page: Page, count: number) {
  for (let i = 1; i <= count; i++) {
    await expect(page.locator('.status')).toContainText(`Frage ${i} von ${count}`);
    await page.waitForTimeout(350);
    await page.locator('.option').first().click();
    await page.locator('.next').click();
  }
}

test('Challenge erstellen, per Link spielen, Rangliste und Versuche', async ({ browser, page, context }) => {
  const db = fakeChallenges();
  await db.install(context);
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Jan legt eine Challenge an
  await page.locator('.card', { hasText: 'Freunde herausfordern' }).click();
  await page.getByLabel('Name der Challenge').fill('Büro-Challenge');
  await page.getByLabel('Dein Name').fill('Jan');
  await page.getByRole('button', { name: 'Europa' }).click();
  await page.getByRole('button', { name: '5', exact: true }).first().click();
  await page.locator('.chips').nth(4).getByRole('button', { name: '3', exact: true }).click();
  await page.locator('.card', { hasText: 'Challenge erstellen' }).click();
  await expect(page.locator('h1')).toHaveText('Büro-Challenge');
  const link = await page.getByLabel('Link zur Challenge').inputValue();
  expect(link).toMatch(/\?c=[a-z0-9]{8}$/);
  const saved = db.challenges[0] as { fragen: { c: string; o: string[] }[][]; versuche: number; laender: number };
  expect(saved.versuche).toBe(3);
  expect(saved.fragen).toHaveLength(3);
  expect(saved.fragen[0]).toHaveLength(5);

  // Eine Kollegin öffnet den Link in ihrem eigenen Browser
  const other = await browser.newContext({ ...test.info().project.use });
  await db.install(other);
  const guest = await other.newPage();
  await guest.goto('http://localhost:4174/?c=' + link.split('?c=')[1]);
  await expect(guest.locator('h1')).toHaveText('Jan fordert dich heraus');
  await expect(guest.locator('.conditions')).toContainText('3 Versuche, der beste zählt');
  await guest.getByLabel('Dein Name für die Rangliste').fill('Anna');
  await guest.locator('.card', { hasText: 'Los geht' }).click();
  await expect(guest.locator('.badge')).toContainText('Challenge · Büro-Challenge');
  await expect(guest.locator('.flag-hint')).toHaveCount(0);
  await play(guest, 5);
  await expect(guest.locator('.form-message')).toHaveText('Eingetragen!');
  expect(db.results).toHaveLength(1);
  expect(db.results[0]).toMatchObject({ name: 'Anna', versuch: 1 });

  await guest.locator('.card', { hasText: 'Rangliste der Challenge' }).click();
  await expect(guest.locator('.board li')).toHaveCount(1);
  await expect(guest.locator('.board li.mine')).toContainText('Anna');

  // zwei weitere Versuche, danach ist Schluss
  for (const n of [2, 3]) {
    await guest.goto('http://localhost:4174/?c=' + link.split('?c=')[1]);
    await guest.locator('.card', { hasText: `Versuch ${n} von 3` }).click();
    await play(guest, 5);
    await expect(guest.locator('.form-message')).toHaveText('Eingetragen!');
  }
  expect(db.results.map((r) => r.versuch)).toEqual([1, 2, 3]);
  await guest.goto('http://localhost:4174/?c=' + link.split('?c=')[1]);
  await expect(guest.locator('.hint')).toHaveText('Du hast alle Versuche gespielt.');
  await guest.locator('.card', { hasText: 'Rangliste ansehen' }).click();
  // pro Person nur der beste Versuch
  await expect(guest.locator('.board li')).toHaveCount(1);

  // Anna findet die Challenge unter „Meine Challenges“ als gespielt
  await guest.goto('http://localhost:4174/');
  await guest.locator('.card', { hasText: 'Meine Challenges' }).click();
  await expect(guest.locator('.my-challenges .card')).toHaveCount(1);
  await expect(guest.locator('.my-challenges')).toContainText('Gerade keine offene Challenge.');
  await expect(guest.locator('.my-challenges .card')).toContainText('Platz 1 von 1');
  await guest.locator('.my-challenges .card').click();
  await expect(guest.locator('.board li.mine')).toContainText('Anna');
  await guest.getByRole('button', { name: 'Zurück' }).click();
  await expect(guest.locator('h1')).toHaveText('Meine Challenges');
  await other.close();

  // Jan hat die eigene Challenge noch nicht gespielt: sie steht unter „Offen“
  await page.goto('./');
  await page.locator('.card', { hasText: 'Meine Challenges' }).click();
  const own = page.locator('.my-challenges .card', { hasText: 'Büro-Challenge' });
  await expect(own).toContainText('von dir');
  await expect(own).toContainText('3 Versuche offen');
  await expect(page.locator('.my-challenges')).toContainText('Noch keine Challenge zu Ende gespielt.');
  await own.click();
  await expect(page.locator('.card', { hasText: 'Los geht' })).toBeVisible();
});

test('unbekannter Challenge-Link', async ({ page, context }) => {
  await fakeChallenges().install(context);
  await page.goto('./?c=zzzzzzzz');
  await expect(page.locator('h1')).toHaveText('Challenge nicht gefunden');
});
