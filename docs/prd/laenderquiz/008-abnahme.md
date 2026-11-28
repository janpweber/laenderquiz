# 008 – Feinschliff und Abnahme am Handy

PRD: docs/prd/laenderquiz.md
Typ: HITL (Abnahme durch Jan)
Blockiert durch: 006, 007
Status: wartet auf Jans Abnahme am Handy

## Was
Spiel bleibt ohne Netz bzw. bei Supabase-Ausfall spielbar. Ein Browser-Test mit Handy-Viewport spielt eine Ranglisten-Runde durch (Supabase gemockt). Abschließend echter Test: Link per WhatsApp öffnen, auf iPhone und Android, im In-App-Browser und im normalen Browser.

## Akzeptanzkriterien
- [ ] Alle Akzeptanzkriterien des PRD erfüllt
- [x] E2E-Test läuft in CI grün
- [x] WhatsApp-Link-Vorschau zeigt sinnvollen Titel (mit Vorschaubild public/og.png)
- [ ] Jan hat am echten Handy abgenommen

## Bezug
User Stories aus dem PRD: #19 und Gesamtabnahme
