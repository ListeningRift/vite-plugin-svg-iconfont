# vite-plugin-svg-iconfont

[![code style](https://antfu.me/badge-code-style.svg)](https://github.com/antfu/eslint-config)

---

A Vite plugin that converts SVG to iconfont. You can maintain your SVG icons in your project and use them just like iconfont.

## Features

- Automatically generate iconfont from SVG icons
- Automatically generate CSS from SVG icons
- Automatically generate font files from SVG icons
- Reload when SVG icons change

Traditional solutions require creating a project on iconfont, adding icon maintainers to the project, and going through upload, review, download and modifying the same four files every time when a new icon is added - tedious and prone to conflicts.

This plugin aims to change this situation - you can maintain your SVG icons in your project and use them just like iconfont.

## Install

```bash
npm install vite-plugin-svg-iconfont
```

## Usage

```ts
import svgIconfontPlugin from 'vite-plugin-svg-iconfont'

export default defineConfig({
  // default include: 'src/assets/icon'
  plugins: [svgIconfontPlugin()],
})
```

## Options

- `include`: The path to the SVG icons directory.
- `name`: The name of the iconfont.
- `iconPrefix`: The prefix of the iconfont.
- ...other else
