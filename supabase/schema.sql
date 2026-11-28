-- Länderquiz: Online-Bestenliste
-- Einmal im Supabase-Dashboard ausführen: SQL Editor → New query → einfügen → Run.
-- Das Skript lässt sich gefahrlos mehrfach ausführen.

-- Sperrliste für Namen. Dieselben Wörter stehen in src/name.ts.
create or replace function public.bestenliste_name_ok(n text)
returns boolean
language sql
immutable
as $$
  select not exists (
    select 1
    from unnest(array[
      'arschloch', 'wichser', 'hurensohn', 'fotze', 'schlampe', 'missgeburt', 'spast',
      'hitler', 'heilhitler', 'siegheil', 'judensau', 'kanake', 'neger', 'nigger', 'nigga',
      'schwuchtel', 'fick', 'fuck', 'cunt', 'bitch', 'whore', 'faggot', 'retard',
      'penis', 'vagina', 'pimmel', 'muschi', 'titten', 'porn'
    ]) as wort
    where position(wort in regexp_replace(
      translate(
        replace(replace(replace(replace(lower(n), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
        '0134578@$!|', 'oieastbasii'
      ),
      '[^a-z]', '', 'g'
    )) > 0
  );
$$;

create table if not exists public.bestenliste (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  richtige smallint not null,
  zeit_ms integer not null
);

-- Ranglisten: Welt mit 10 Ländern, jeder Kontinent mit 5 (Modus „Normal“).
-- Erweitert auch eine ältere Tabelle ohne diese Spalte.
alter table public.bestenliste add column if not exists modus text not null default 'Welt';

alter table public.bestenliste drop constraint if exists name_laenge;
alter table public.bestenliste drop constraint if exists name_erlaubt;
alter table public.bestenliste drop constraint if exists modus_erlaubt;
alter table public.bestenliste drop constraint if exists richtige_bereich;
alter table public.bestenliste drop constraint if exists zeit_bereich;

alter table public.bestenliste
  -- Name getrimmt, 1 bis 20 Zeichen, nicht gesperrt
  add constraint name_laenge check (name = btrim(name) and char_length(name) between 1 and 20),
  add constraint name_erlaubt check (public.bestenliste_name_ok(name)),
  add constraint modus_erlaubt check (modus in ('Welt', 'Afrika', 'Asien', 'Europa', 'Nordamerika', 'Südamerika', 'Ozeanien')),
  -- höchstens so viele richtige wie Fragen
  add constraint richtige_bereich check (richtige between 0 and (case modus when 'Welt' then 10 else 5 end)),
  -- mindestens 0,3 s je Frage, höchstens 30 Minuten
  add constraint zeit_bereich check (
    zeit_ms between 300 * (case modus when 'Welt' then 10 else 5 end) and 1800000
  );

drop index if exists public.bestenliste_rang;
create index if not exists bestenliste_modus_rang on public.bestenliste (modus, richtige desc, zeit_ms asc, created_at asc);

-- Row Level Security: öffentlich nur lesen und eintragen.
-- Ändern und Löschen geht nur im Dashboard (Table Editor).
alter table public.bestenliste enable row level security;

drop policy if exists "bestenliste lesen" on public.bestenliste;
create policy "bestenliste lesen" on public.bestenliste
  for select to anon, authenticated using (true);

drop policy if exists "bestenliste eintragen" on public.bestenliste;
create policy "bestenliste eintragen" on public.bestenliste
  for insert to anon, authenticated with check (true);

-- Zusätzlich die Rechte selbst entziehen, falls später jemand eine Policy ergänzt
revoke update, delete, truncate on public.bestenliste from anon, authenticated;
grant select, insert on public.bestenliste to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Challenges per Link (ab Dezember 2026)
-- ---------------------------------------------------------------------------

create table if not exists public.challenges (
  id text primary key,
  created_at timestamptz not null default now(),
  titel text not null,
  ersteller text not null,
  region text not null,
  laender smallint not null,
  tempo smallint not null,
  versuche smallint not null,
  -- gleiche Länder für alle: je Versuch die Fragen [{"c": "DEU", "o": ["DEU", "AUT", "CHE", "POL"]}, …], sonst null
  fragen jsonb
);

alter table public.challenges drop constraint if exists challenge_id;
alter table public.challenges drop constraint if exists challenge_titel;
alter table public.challenges drop constraint if exists challenge_ersteller;
alter table public.challenges drop constraint if exists challenge_werte;
alter table public.challenges drop constraint if exists challenge_fragen;

alter table public.challenges
  add constraint challenge_id check (id ~ '^[a-z0-9]{8}$'),
  add constraint challenge_titel check (
    titel = btrim(titel) and char_length(titel) between 1 and 40 and public.bestenliste_name_ok(titel)
  ),
  add constraint challenge_ersteller check (
    ersteller = btrim(ersteller) and char_length(ersteller) between 1 and 20 and public.bestenliste_name_ok(ersteller)
  ),
  add constraint challenge_werte check (
    region in ('Welt', 'Afrika', 'Asien', 'Europa', 'Nordamerika', 'Südamerika', 'Ozeanien')
    and laender in (5, 10, 20)
    and tempo in (0, 2, 3, 5)
    and versuche in (1, 3, 5)
  ),
  -- höchstens etwa 20 KB, und genau so viele Versuche wie eingestellt
  add constraint challenge_fragen check (
    fragen is null
    or (jsonb_typeof(fragen) = 'array' and jsonb_array_length(fragen) = versuche and pg_column_size(fragen) <= 20000)
  );

create table if not exists public.challenge_ergebnisse (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  challenge_id text not null references public.challenges (id) on delete cascade,
  -- zufällige Kennung des Geräts, damit pro Person der beste Versuch zählt
  spieler uuid not null,
  name text not null,
  versuch smallint not null,
  richtige smallint not null,
  zeit_ms integer not null,
  unique (challenge_id, spieler, versuch)
);

alter table public.challenge_ergebnisse drop constraint if exists ergebnis_name;
alter table public.challenge_ergebnisse drop constraint if exists ergebnis_werte;
alter table public.challenge_ergebnisse
  add constraint ergebnis_name check (
    name = btrim(name) and char_length(name) between 1 and 20 and public.bestenliste_name_ok(name)
  ),
  add constraint ergebnis_werte check (versuch between 1 and 5 and richtige between 0 and 20 and zeit_ms between 0 and 1800000);

-- Werte passend zur Challenge prüfen: Versuch, richtige und Mindestzeit (0,3 s je Land)
create or replace function public.challenge_ergebnis_pruefen()
returns trigger
language plpgsql
as $$
declare
  c public.challenges%rowtype;
begin
  select * into c from public.challenges where id = new.challenge_id;
  if new.versuch > c.versuche then
    raise exception 'Versuch % gibt es in dieser Challenge nicht', new.versuch using errcode = '23514';
  end if;
  if new.richtige > c.laender then
    raise exception 'Mehr richtige als Länder' using errcode = '23514';
  end if;
  if new.zeit_ms < 300 * c.laender then
    raise exception 'Zu schnell' using errcode = '23514';
  end if;
  if c.tempo > 0 and new.zeit_ms > c.tempo * 1000 * c.laender + 1000 then
    raise exception 'Länger als das Zeitlimit erlaubt' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists challenge_ergebnis_pruefen on public.challenge_ergebnisse;
create trigger challenge_ergebnis_pruefen
  before insert on public.challenge_ergebnisse
  for each row execute function public.challenge_ergebnis_pruefen();

create index if not exists challenge_ergebnisse_challenge on public.challenge_ergebnisse (challenge_id);

-- Öffentlich nur lesen und anlegen; Löschen nur im Dashboard
alter table public.challenges enable row level security;
alter table public.challenge_ergebnisse enable row level security;

drop policy if exists "challenges lesen" on public.challenges;
create policy "challenges lesen" on public.challenges for select to anon, authenticated using (true);
drop policy if exists "challenges anlegen" on public.challenges;
create policy "challenges anlegen" on public.challenges for insert to anon, authenticated with check (true);

drop policy if exists "ergebnisse lesen" on public.challenge_ergebnisse;
create policy "ergebnisse lesen" on public.challenge_ergebnisse for select to anon, authenticated using (true);
drop policy if exists "ergebnisse eintragen" on public.challenge_ergebnisse;
create policy "ergebnisse eintragen" on public.challenge_ergebnisse for insert to anon, authenticated with check (true);

revoke update, delete, truncate on public.challenges, public.challenge_ergebnisse from anon, authenticated;
grant select, insert on public.challenges, public.challenge_ergebnisse to anon, authenticated;
