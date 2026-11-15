import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const out = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife',
  write: false, target: 'es2020',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bottes à réacteurs — modèle 3D</title>
<style>
  html,body{margin:0;height:100%;background:#000;color:#cfd6dd;font-family:system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
  #c{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none}
  .ui{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding:14px}
  button{background:#0d1217;color:#cfd6dd;border:1px solid #2a3540;border-radius:10px;padding:10px 16px;font-size:14px;cursor:pointer}
  button.on{border-color:#3aa7ff;color:#bfe4ff;box-shadow:0 0 14px rgba(58,167,255,.35)}
  button:hover{background:#141b22}
  .hint{position:fixed;top:12px;left:0;right:0;text-align:center;font-size:13px;color:#7c8894;pointer-events:none}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div class="hint">Glisser pour tourner · molette ou pincer pour zoomer</div>
<div class="ui">
  <button id="thrust" class="on">Réacteurs : ON</button>
  <button id="view">Vue : face / dos</button>
  <button id="rotate">Rotation auto : OFF</button>
</div>
<script>${js}</script>
</body>
</html>`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0), 'KB');
