import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientPath = resolve(__dirname, '..', 'dist', 'client.js')

function inlineImports(entryPath) {
  const seen = new Set()
  const modules = []

  function walk(filePath) {
    const real = resolve(filePath)
    if (seen.has(real)) return
    seen.add(real)

    let code = readFileSync(real, 'utf8')
    const dir = dirname(real)

    const importRegex = /import\s+(?:\{([^}]*)\}|\*\s+as\s+(\w+)|(\w+))?\s*(?:,\s*\{([^}]*)\})?\s*from\s+['"](\.{1,2}\/[^'"]+)['"]\s*;?/g
    const reexportRegex = /export\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\*)\s+from\s+['"](\.{1,2}\/[^'"]+)['"]\s*;?/g

    const depPaths = new Set()
    let m
    importRegex.lastIndex = 0
    while ((m = importRegex.exec(code)) !== null) {
      depPaths.add(m[5])
    }
    reexportRegex.lastIndex = 0
    while ((m = reexportRegex.exec(code)) !== null) {
      depPaths.add(m[1])
    }
    for (const dep of depPaths) {
      let depFile = resolve(dir, dep)
      if (!existsSync(depFile)) {
        if (existsSync(depFile + '.js')) depFile += '.js'
        else continue
      }
      walk(depFile)
    }

    code = code.replace(importRegex, '')
    code = code.replace(reexportRegex, '')

    modules.push({ path: real, code })
  }

  walk(entryPath)

  return modules.map((m) => `// ${relative(dirname(entryPath), m.path)}\n${m.code}`).join('\n')
}

const raw = readFileSync(clientPath, 'utf8')
if (raw.includes('window.__ModuleLoader__.load')) {
  console.log('[wrap-client] dist/client.js already wrapped, skipping')
  process.exit(0)
}

let code = inlineImports(clientPath)

const exportedNames = []
const nameRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g
let mm
while ((mm = nameRegex.exec(code)) !== null) {
  exportedNames.push(mm[1])
}

code = code.replace(/^export\s+/gm, '')

const exportsAssignments = exportedNames
  .map((name) => `\texports.${name} = ${name};`)
  .join('\n')

const wrapped = `window.__ModuleLoader__.load({
\tid: "dsh-ontology",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
\t\tlet __dshReact = require("react");
\t\tlet __dshReactDOM = require("react-dom");
\t\twindow.__dshReact = __dshReact;
\t\twindow.__dshReactDOM = __dshReactDOM;
${code}
${exportsAssignments}
\t\treturn module.exports;
\t}
});
`

writeFileSync(clientPath, wrapped, 'utf8')
console.log(`[wrap-client] wrapped dist/client.js (${exportedNames.length} exports: ${exportedNames.join(', ')})`)