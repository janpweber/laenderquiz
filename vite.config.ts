import { defineConfig } from 'vite';

export default defineConfig({
  // Relative Pfade, damit die App unter /laenderquiz/ auf GitHub Pages läuft
  base: './',
  build: {
    // Die Länderdaten sind eine große Datei (gzip ca. 400 KB), das ist gewollt
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: 'index.html',
        // Übersicht aller Umrisse zum Prüfen der Daten
        uebersicht: 'uebersicht.html',
      },
    },
  },
});
