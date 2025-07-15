import esbuild from 'esbuild'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

async function build() {
  try {
    await esbuild.build({
      entryPoints: [resolve(__dirname, '../src/background.ts')],
      bundle: true,
      outfile: resolve(__dirname, '../dist/background.js'),
      platform: 'browser',
      target: 'chrome89',
      format: 'iife',
      sourcemap: process.env.NODE_ENV !== 'production',
      minify: process.env.NODE_ENV === 'production',
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
      }
    })
    console.log('Background script built successfully')
  } catch (error) {
    console.error('Build failed:', error)
    process.exit(1)
  }
}

build()