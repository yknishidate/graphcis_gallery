// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://yknishidate.github.io',
  base: '/graphics_gallery',
  trailingSlash: "never",
  devToolbar: {
    enabled: false
  }
});
