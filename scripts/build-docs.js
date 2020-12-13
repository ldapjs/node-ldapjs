const fs = require('fs/promises')
const path = require('path')
const marked = require('marked')
const fm = require('front-matter')

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

function createHTML (header, footer, text) {
  const { attributes, body } = fm(text)
  for (const prop in attributes) {
    header = header.replace(new RegExp(`%\\(${prop}\\)s`, 'ig'), attributes[prop])
    footer = footer.replace(new RegExp(`%\\(${prop}\\)s`, 'ig'), attributes[prop])
  }

  const { toc, html } = markdownTOC(body)

  header = header.replace(/%\(toc_html\)s/ig, toc)

  return header + html + footer
}

async function createDocs () {
  const docs = path.resolve(__dirname, '..', 'docs')
  const dist = path.resolve(__dirname, '..', 'public')
  const branding = path.join(docs, 'branding')

  await fs.rmdir(dist, { recursive: true })
  await fs.mkdir(dist)

  const header = await fs.readFile(path.join(branding, 'header.html.in'), { encoding: 'utf8' })
  const footer = await fs.readFile(path.join(branding, 'footer.html.in'), { encoding: 'utf8' })
  const files = await fs.readdir(docs)
  for (const file of files) {
    if (!file.endsWith('.md')) {
      continue
    }
    const text = await fs.readFile(path.join(docs, file), { encoding: 'utf8' })
    const html = createHTML(header, footer, text)

    await fs.writeFile(path.join(dist, file.replace(/md$/, 'html')), html)
  }

  const dest = path.join(dist, 'media')
  const src = path.join(branding, 'media')
  await fs.mkdir(dest)
  await fs.mkdir(path.join(dest, 'css'))
  await fs.mkdir(path.join(dest, 'img'))
  await fs.copyFile(path.join(src, 'css', 'style.css'), path.join(dest, 'css', 'style.css'))
  await fs.copyFile(path.join(src, 'img', 'logo.svg'), path.join(dest, 'img', 'logo.svg'))
  await fs.copyFile(path.join(branding, 'CNAME'), path.join(dist, 'CNAME'))
}

createDocs().catch(ex => {
  console.error(ex)
  process.exit(1)
})
