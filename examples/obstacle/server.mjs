import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripTypeScriptTypes } from 'node:module'

const workspaceRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
    case '.mjs':
    case '.ts':
      return 'application/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'text/plain; charset=utf-8'
  }
}

async function resolveFile(root, pathname) {
  const cleanPath = pathname === '/' ? '/examples/obstacle/index.html' : pathname
  const resolved = path.resolve(root, `.${cleanPath}`)
  if (!resolved.startsWith(root)) {
    return null
  }

  try {
    const info = await stat(resolved)
    if (info.isDirectory()) {
      const nested = path.join(resolved, 'index.html')
      await stat(nested)
      return nested
    }
    return resolved
  } catch {
    return null
  }
}

export function createDemoServer({ root = workspaceRoot } = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const filePath = await resolveFile(root, decodeURIComponent(url.pathname))
    if (!filePath) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }

    try {
      let payload = await readFile(filePath)
      if (filePath.endsWith('.ts')) {
        payload = Buffer.from(
          stripTypeScriptTypes(payload.toString('utf8'), {
            mode: 'transform'
          }),
          'utf8'
        )
      }

      response.writeHead(200, {
        'content-type': contentType(filePath),
        'cache-control': 'no-store'
      })
      response.end(payload)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(String(error))
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.BYETEXT_DEMO_PORT ?? 4173)
  const server = createDemoServer()
  server.listen(port, () => {
    console.log(`ByeText demo server running at http://127.0.0.1:${port}/examples/obstacle/index.html`)
  })
}
