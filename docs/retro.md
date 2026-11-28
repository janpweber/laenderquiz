# Retro-Notizen

Punkte für die nächste Retro. Neue Einträge oben.

## 28.11.2026 – Sperrwörter-Abgleich scheiterte dreimal an der Konfiguration

**Was passiert ist**
1. Erster Lauf: `401 Invalid API key`. Das Skript schickte den Schlüssel auch als `Authorization: Bearer`. Neue Supabase-Schlüssel (`sb_secret_…`) gehen dort nicht.
2. Zweiter Versuch: Im Secret stand das Datenbank-Passwort. Meine Anleitung („secret/service_role“) war nicht eindeutig genug, welcher der vielen Supabase-Werte gemeint ist.
3. Dritter Lauf: `403 permission denied for table sperrwoerter`. Das Schema gab `service_role` keine Rechte auf die neue Tabelle. Lokal fiel das nicht auf, weil die Test-Datenbank keine Supabase-Rollen hat.

**Ursachen**
- Gegen echtes Supabase konnte ich aus der Entwicklungsumgebung nicht testen (Netz gesperrt). Die lokale Postgres-Probe bildet Supabase-Rollen und -Schlüssel nicht ab.
- Die Anleitung für Secrets nannte den Weg, aber nicht, wie der richtige Wert aussieht.

**Was wir künftig anders machen**
- Bei Secrets immer sagen, woran man den richtigen Wert erkennt (z. B. „beginnt mit `sb_secret_`“) und was es *nicht* ist (Datenbank-Passwort, `sb_publishable_`).
- Jede neue Tabelle bekommt die Rechte für alle Rollen, die sie nutzen (`anon`, `authenticated`, `service_role`), und die lokale Test-Datenbank legt diese Rollen wie Supabase an (inkl. `bypassrls` für `service_role`).
- Skripte, die Supabase-Schlüssel nutzen, unterstützen alte (JWT) und neue Schlüssel.
- Bei Workflows, die nur mit echten Secrets laufen, vorab einen Probelauf-Schritt mit klarer Fehlermeldung einbauen und Jan die erwartete Ausgabe nennen.
