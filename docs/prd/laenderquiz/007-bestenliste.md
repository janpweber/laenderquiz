# 007 – Online-Bestenliste mit Supabase

PRD: docs/prd/laenderquiz.md
Typ: HITL (braucht Jans Supabase-Projekt; Schema wird von Jan ausgeführt)
Blockiert durch: 004, 005, Supabase-Zugang von Jan
Status: offen

## Was
Versioniertes SQL-Schema: Tabelle für Einträge, Constraints (Name 1–20 Zeichen, 0–10 richtige, plausible Gesamtzeit), serverseitiger Wortfilter, RLS nur Lesen und Einfügen. Nach einer Standardrunde (10, Welt, Normal, mit Zeitlimit) kann man sich mit Namen eintragen. Bestenliste-Bildschirm sortiert nach richtigen Antworten, dann Zeit. Nach anderen Runden ein Hinweis.

## Akzeptanzkriterien
- [ ] Eintrag nur nach Standardrunde angeboten
- [ ] Sortierung korrekt
- [ ] Zu lange/gefilterte Namen und unmögliche Werte werden auch bei direktem API-Aufruf abgelehnt (manuell geprüft)
- [ ] Ändern/Löschen über den Anon-Key nicht möglich, Löschen im Dashboard möglich
- [ ] Service-Role-Key nirgends im Repository
- [ ] Fehler von Supabase werden freundlich angezeigt

## Bezug
User Stories aus dem PRD: #15, #16, #17, #18, #20, #21
