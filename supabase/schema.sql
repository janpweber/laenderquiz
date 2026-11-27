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
