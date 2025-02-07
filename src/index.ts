import type { FontOptions } from '@miconfont/convert'
import type { Plugin } from 'vite'
import { Buffer } from 'node:buffer'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { convertFont } from '@miconfont/convert'
import { watch } from 'chokidar'

export type SvgIconfontOptions = {
  include: string
} & FontOptions

function getAllSvgs(input: string): { name: string, content: string }[] {
  const files = readdirSync(resolve(input))
  return files
    .map((file) => {
      if (extname(file) === '.svg') {
        return {
          name: basename(file, '.svg'),
          content: readFileSync(join(input, file), 'utf-8'),
        }
      }
      return undefined
    })
    .filter(item => item) as { name: string, content: string }[]
}

async function generateFonts(options: SvgIconfontOptions): Promise<{ cssString: string, fontBuffer: { ttf: Buffer, woff: Buffer, woff2: Buffer } }> {
  const svgs = await getAllSvgs(options.include)
  const fontOptions = { ...options }
  delete (fontOptions as any).include
  return await convertFont(svgs, fontOptions)
}

export default function svgIconfontPlugin(options?: SvgIconfontOptions): Plugin {
  options = {
    ...options,
    include: options?.include || 'src/assets/icon',
    name: options?.name || 'iconfont',
    iconPrefix: options?.iconPrefix || 'icon',
  }

  const virtualModuleId = 'virtual:svg-iconfont.css'
  const resolvedVirtualModuleId = `\0${virtualModuleId}`
  let cssString = ''
  let ttfBuffer: Buffer | null = null
  let woffBuffer: Buffer | null = null
  let woff2Buffer: Buffer | null = null

  const FONT_PLACEHOLDERS = '__VITE_SVG_ICONFONT_FONT_PLACEHOLDERS__'

  async function loadFonts(): Promise<void> {
    const font = await generateFonts(options!)
    cssString = font.cssString.replace(new RegExp(`${options?.name}\\.(ttf|woff2?)`, 'g'), (_, ext) => `${FONT_PLACEHOLDERS}.${ext}`)
    ttfBuffer = font.fontBuffer.ttf
    woffBuffer = font.fontBuffer.woff
    woff2Buffer = font.fontBuffer.woff2
  }

  return {
    name: 'vite-plugin-svg-iconfont',

    resolveId(id: string) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
    },

    async load(id) {
      if (id === resolvedVirtualModuleId) {
        await loadFonts()
        return cssString
      }
    },

    configureServer(server) {
      if (!existsSync(options.include)) {
        console.warn('Watch path does not exist:', options.include)
      }
      const watcher = watch(options.include, {
        ignoreInitial: true,
        persistent: true,
      })

      async function callback(): Promise<void> {
        await loadFonts()
        // 获取虚拟模块
        const module = server.moduleGraph.getModuleById(resolvedVirtualModuleId)
        if (module) {
          // 使模块失效
          server.moduleGraph.invalidateModule(module)
          // 触发 HMR
          server.ws.send({ type: 'full-reload' })
        }
      }

      watcher.on('add', callback)
      watcher.on('unlink', callback)
      watcher.on('change', callback)

      server.httpServer?.on('close', () => {
        watcher.close()
      })

      server.middlewares.use((req, res, next) => {
        if (req.url === `/${FONT_PLACEHOLDERS}.ttf` || req.url === `/${FONT_PLACEHOLDERS}.woff` || req.url === `/${FONT_PLACEHOLDERS}.woff2`) {
          const fontType = req.url.split(`/${FONT_PLACEHOLDERS}.`)[1]
          if (ttfBuffer && fontType === 'ttf') {
            const fontBuffer = ttfBuffer
            res.setHeader('Content-Type', `font/${fontType}`)
            res.end(fontBuffer)
          }
          else if (woffBuffer && fontType === 'woff') {
            const fontBuffer = woffBuffer
            res.setHeader('Content-Type', `font/${fontType}`)
            res.end(fontBuffer)
          }
          else if (woff2Buffer && fontType === 'woff2') {
            const fontBuffer = woff2Buffer
            res.setHeader('Content-Type', `font/${fontType}`)
            res.end(fontBuffer)
          }
          else {
            res.statusCode = 404
            res.end()
          }
        }
        else {
          next()
        }
      })
    },

    generateBundle(_, bundle) {
      if (ttfBuffer) {
        this.emitFile({
          type: 'asset',
          name: 'iconfont.ttf',
          source: ttfBuffer,
        })
      }
      if (woffBuffer) {
        this.emitFile({
          type: 'asset',
          name: 'iconfont.woff',
          source: woffBuffer,
        })
      }
      if (woff2Buffer) {
        this.emitFile({
          type: 'asset',
          name: 'iconfont.woff2',
          source: woff2Buffer,
        })
      }

      const fontFileNames: Record<string, string | undefined> = {}
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && 'source' in asset && asset.source instanceof Buffer) {
          // 通过比较 buffer 来找到对应的文件
          if (ttfBuffer && asset.source.equals(ttfBuffer)) {
            fontFileNames.ttf = fileName.split('/').pop()
          }
          else if (woffBuffer && asset.source.equals(woffBuffer)) {
            fontFileNames.woff = fileName.split('/').pop()
          }
          else if (woff2Buffer && asset.source.equals(woff2Buffer)) {
            fontFileNames.woff2 = fileName.split('/').pop()
          }
        }
      }

      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && asset.name?.endsWith('.css') && typeof asset.source === 'string' && asset.source.includes(FONT_PLACEHOLDERS)) {
          const newSource = (asset.source as string).replace(new RegExp(`${FONT_PLACEHOLDERS}.(ttf|woff2?)`, 'g'), (_, ext) => fontFileNames[ext] || '')
          bundle[fileName] = {
            ...asset,
            source: newSource,
          }
        }
      }
    },
  }
}
