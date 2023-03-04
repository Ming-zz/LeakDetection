import ts from 'rollup-plugin-typescript2';

export default [
  'cjs',
  'es',
  'umd'
].map(format => ({
  input: 'src/index.ts',
  output: {
    name: 'EventListenersDetect',
    file: `dist/index.${format}.js`,
    format,
  },
  plugins: [
    ts(),
  ],
}))
