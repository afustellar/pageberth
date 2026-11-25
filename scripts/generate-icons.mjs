import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const root = fileURLToPath(new URL('..', import.meta.url))
const appSvg = readFileSync(join(root, 'public/pageberth.svg'))
const avatarSvg = readFileSync(join(root, '.github/social-avatar.svg'))
const previewSvg = readFileSync(join(root, '.github/social-preview.svg'))

function renderSvg(source, width) {
  return new Resvg(source, { fitTo: { mode: 'width', value: width } }).render().asPng()
}

const appPng = renderSvg(appSvg, 512)
writeFileSync(join(root, 'public/pageberth.png'), appPng)
writeFileSync(join(root, 'build/icon.png'), appPng)
writeFileSync(join(root, 'assets/avatar.png'), renderSvg(avatarSvg, 512))
writeFileSync(join(root, '.github/social-preview.png'), renderSvg(previewSvg, 1200))
writeFileSync(join(root, 'build/icon.ico'), await pngToIco([16, 24, 32, 48, 64, 128, 256].map(size => renderSvg(appSvg, size))))
writeFileSync(join(root, 'favicon.ico'), await pngToIco([16, 32, 48].map(size => renderSvg(appSvg, size))))
