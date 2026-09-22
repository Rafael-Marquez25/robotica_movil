import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';

export default defineConfig({
  site: 'https://rafael-marquez25.github.io',
  base: '/robotica_movil',
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    processor: satteri({
      hastPlugins: [{
        name: 'keyboard-accessible-tables',
        element: {
          filter: ['table'],
          visit(node, context) {
            // Make wide Markdown tables scrollable with the keyboard, without browser JS.
            context.setProperty(node, 'tabIndex', 0);
          },
        },
      }],
    }),
    shikiConfig: { theme: 'github-light' },
  },
});
