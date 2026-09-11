const fs = require('fs');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const htmlMinify = require('html-minifier-terser');

(async () => {
  const jsFiles = ['script.js', 'profile-config.js', 'worker.js', 'worker-visits.js', 'eye.js'];
  for (const file of jsFiles) {
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const out = await minify(source, { compress: true, mangle: true, ecma: 2020 });
    if (out && out.code) fs.writeFileSync(file, out.code);
  }

  const cssFiles = ['style.css'];
  for (const file of cssFiles) {
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const out = new CleanCSS({ level: 2 }).minify(source);
    fs.writeFileSync(file, out.styles || source);
  }

  const htmlFiles = ['index.html', 'aezra.html', 'jay.html'];
  for (const file of htmlFiles) {
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const out = await htmlMinify.minify(source, {
      collapseWhitespace: true,
      removeComments: true,
      removeOptionalTags: true,
      removeRedundantAttributes: true,
      useShortDoctype: true,
      minifyCSS: true,
      minifyJS: true,
      quoteCharacter: '"'
    });
    fs.writeFileSync(file, out);
  }

  const sizes = {};
  for (const file of ['index.html', 'aezra.html', 'jay.html', 'style.css', 'script.js', 'profile-config.js', 'worker.js', 'worker-visits.js', 'eye.js']) {
    if (fs.existsSync(file)) sizes[file] = fs.statSync(file).size;
  }
  console.log(JSON.stringify(sizes, null, 2));
})();
