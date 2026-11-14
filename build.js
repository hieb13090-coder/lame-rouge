// construit le jeu : src/head.html + src/js/*.js (dans l'ordre des noms) → index.html (le site), dist/ et test/index.html
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'src'), js = fs.readdirSync(path.join(dir, 'js')).filter(f => f.endsWith('.js')).sort();
const head = fs.readFileSync(path.join(dir, 'head.html'), 'utf8');
const code = js.map(f => fs.readFileSync(path.join(dir, 'js', f), 'utf8')).join('\n');
const script = `<script>
if (typeof THREE === 'undefined') { document.getElementById('menu').hidden = true; document.getElementById('fatal').hidden = false; document.getElementById('fatal-msg').textContent = "La bibliothèque 3D n'a pas pu être chargée. Vérifiez la connexion puis rechargez la page."; }
else (function () {
'use strict';
${code}
})();
</script>
`;
const page = head + script;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'lame-rouge.html'), page);
// version d'essai : document complet + bibliothèque locale
const test = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' +
  page.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', '../node_modules/three/build/three.min.js').split('https://cdn.jsdelivr.net/npm/three@0.128.0/').join('../node_modules/three/').replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/, '') + '</body></html>';
fs.mkdirSync(path.join(__dirname, 'test'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'test', 'index.html'), test);
console.log('built', (page.length / 1024).toFixed(1) + ' KB', js.join(' '));
// version à garder : un seul fichier, bibliothèque 3D incluse, jouable hors connexion
const nm = path.join(__dirname, 'node_modules', 'three');
let solo = page.replace(/<script src="([^"]+)"><\/script>/g, (m, url) => {
  const f = url.includes('cdnjs') ? path.join(nm, 'build', 'three.min.js') : path.join(nm, url.split('three@0.128.0/')[1]);
  const src = fs.readFileSync(f, 'utf8'); if (src.includes('</script')) throw new Error('balise dans ' + f);
  return '<script>' + src + '</script>';
});
solo = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:dark}html,body{height:100%}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + solo + '</body></html>';
fs.writeFileSync(path.join(__dirname, 'dist', 'Lame-Rouge-jeu.html'), solo);
// le site (GitHub Pages) sert ce fichier : il est reconstruit à chaque build
fs.writeFileSync(path.join(__dirname, 'index.html'), solo);
console.log('solo', (solo.length / 1024).toFixed(0) + ' KB', (solo.match(/<script src=/g) || []).length + ' scripts externes');
