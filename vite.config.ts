import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const staticImages = [
    ['coral_homestay_cafe_hero_1785470198116.jpg', 'coral-hero.jpg'],
    ['coral_homestay_cafe_hero_1785470198116.jpg', 'coral_homestay_cafe_hero.jpg'],
    ['bungalow_cliff_day_1785468102824.jpg', 'bungalow-cliff-day.jpg'],
    ['bungalow_row_sunset_1785468123069.jpg', 'bungalow-row-sunset.jpg'],
    ['bungalow_bathtub_ocean_1785468137291.jpg', 'bungalow-bathtub-ocean.jpg'],
    ['bungalow_bedroom_twin_1785468156202.jpg', 'bungalow-bedroom-twin.jpg'],
    ['bungalow_sunset_front_1785468172987.jpg', 'bungalow-sunset-front.jpg'],
    ['bungalow_cliff_day_1785468102824.jpg', 'bungalow_cliff_day.jpg'],
    ['bungalow_row_sunset_1785468123069.jpg', 'bungalow_row_sunset.jpg'],
    ['bungalow_bathtub_ocean_1785468137291.jpg', 'bungalow_bathtub_ocean.jpg'],
    ['bungalow_bedroom_twin_1785468156202.jpg', 'bungalow_bedroom_twin.jpg'],
    ['bungalow_sunset_front_1785468172987.jpg', 'bungalow_sunset_front.jpg'],
  ] as const;

  return {
    // AI Studio encoded the files in public/images as UTF-8 text, corrupting
    // their binary JPEG bytes. Build the public image URLs from the intact
    // source assets instead, while preserving every existing URL.
    publicDir: false,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'emit-coral-static-images',
        buildStart() {
          for (const [sourceName, publicName] of staticImages) {
            this.emitFile({
              type: 'asset',
              fileName: `images/${publicName}`,
              source: fs.readFileSync(
                path.resolve(__dirname, 'src/assets/images', sourceName),
              ),
            });
          }

          const publicAssetsDir = path.resolve(__dirname, 'public/assets');
          if (fs.existsSync(publicAssetsDir)) {
            for (const entry of fs.readdirSync(publicAssetsDir, { withFileTypes: true })) {
              if (entry.isFile() && /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(entry.name)) {
                this.emitFile({
                  type: 'asset',
                  fileName: `assets/${entry.name}`,
                  source: fs.readFileSync(path.join(publicAssetsDir, entry.name)),
                });
              }
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
