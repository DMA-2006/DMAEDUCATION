import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Django tourne sur la même machine que Vite, sur le port 8001
// (le 8000 est pris par un autre projet) : « python manage.py runserver 8001 »
const DJANGO = 'http://127.0.0.1:8001'

export default defineConfig({
  plugins: [react()],
  server: {
    // Visible sur le réseau local (téléphone sur le même Wi-Fi)
    host: true,

    // Ton adresse ngrok (gratuite et stable pour ton compte)
    allowedHosts: ['mulch-yelp-aspirin.ngrok-free.dev'],

    // Vite transmet à Django tout ce qui commence par /api (et /media).
    proxy: {
      '/api': { target: DJANGO, changeOrigin: true },
      '/media': { target: DJANGO, changeOrigin: true },
    },
  },
})