import { defineConfig } from 'tsdown'

export default defineConfig({
  name: 'dsh-plugin-kiro/client',
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: ['react', 'react/jsx-runtime'],
  noExternal: (id: string) => (id === 'react' || id === 'react/jsx-runtime' ? undefined : true),
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-plugin-kiro", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
