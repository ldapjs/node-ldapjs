const fs = require('fs/promises')
const path = require('path')
const { marked } = require('marked')
const fm = require('front-matter')
const { highlight } = require('highlight.js')

marked.use({
  highlight: (code, lang) => {
    if (lang) {
      return highlight(code, { language: lang }).value
    }

    return code
  }
})

function tocHTML (toc) {
  let html = '<ul>\n'
  for (const li of toc) {
    html += '<li>\n'
    html += `<div>\n<a href="#${li.slug}">${li.text}</a>\n</div>\n`
    if (li.children && li.children.length > 0) {
      html += tocHTML(li.children)
    }
    html += '</li>\n'
  }
  html += '</ul>\n'

  return html
}

function markdownTOC (markdown) {
  const tokens = marked.lexer(markdown)
  const slugger = new marked.Slugger()
  const toc = []
  let currentHeading
  let ignoreFirst = true
  for (const token of tokens) {
    if (token.type === 'heading') {
      if (token.depth === 1) {
        if (ignoreFirst) {
          ignoreFirst = false
          continue
        }
        currentHeading = {
          text: token.text,
          slug: slugger.slug(token.text),
          children: []
        }
        toc.push(currentHeading)
      } else if (token.depth === 2) {
        if (!currentHeading) {
          continue
        }
        currentHeading.children.push({
          text: token.text,
          slug: slugger.slug(token.text)
        })
      }
    }
  }

  return {
    toc: tocHTML(toc),
    html: marked.parser(tokens)
  }
}

function createHTML (template, text) {
  const { attributes, body } = fm(text)

  const { toc, html } = markdownTOC(body)
  attributes.toc_html = toc
  attributes.content = html

  for (const prop in attributes) {
    template = template.replace(new RegExp(`%\\(${prop}\\)s`, 'ig'), attributes[prop])
  }

  return template
}

async function copyRecursive (src, dest) {
  const stats = await fs.stat(src)
  const isDirectory = stats.isDirectory()
  if (isDirectory) {
    await fs.mkdir(dest)
    const files = await fs.readdir(src)
    for (const file of files) {
      await copyRecursive(path.join(src, file), path.join(dest, file))
    }
  } else {
    await fs.copyFile(src, dest)
  }
}

async function createDocs () {
  const docs = path.resolve(__dirname, '..', 'docs')
  const dist = path.resolve(__dirname, '..', 'public')
  const branding = path.join(docs, 'branding')
  const src = path.join(branding, 'public')

  try {
    await fs.rm(dist, { recursive: true })
  } catch (ex) {
    if (ex.code !== 'ENOENT') {
      throw ex
    }
  }
  await copyRecursive(src, dist)

  const highlightjsStyles = path.resolve(__dirname, '..', 'node_modules', 'highlight.js', 'styles')
  await fs.copyFile(path.join(highlightjsStyles, 'default.css'), path.join(dist, 'media', 'css', 'highlight.css'))

  const template = await fs.readFile(path.join(branding, 'template.html'), { encoding: 'utf8' })
  const files = await fs.readdir(docs)
  for (const file of files) {
    if (!file.endsWith('.md')) {
      continue
    }
    const text = await fs.readFile(path.join(docs, file), { encoding: 'utf8' })
    const html = createHTML(template, text)

    await fs.writeFile(path.join(dist, file.replace(/md$/, 'html')), html)
  }
}

createDocs().catch(ex => {
  console.error(ex)
  process.exitCode = 1
})
