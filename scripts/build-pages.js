const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const apps = require('./app.config.js');

function runBuild(target) {
  console.log(`\n--- Building ${target} ---`);
  const env = Object.assign({}, process.env, { NODE_ENV: 'production', BUILD_TARGET: target });
  const result = spawnSync('npm', ['run', 'build:react'], { stdio: 'inherit', env, shell: true });
  if (result.status !== 0) {
    throw new Error(`Build for ${target} failed with exit code ${result.status}`);
  }
}

function copyBuild(outDir) {
  const src = path.resolve(process.cwd(), 'build');
  const dest = path.resolve(process.cwd(), outDir);
  if (!fs.existsSync(src)) {
    throw new Error('No build directory found to copy from');
  }

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  fs.cpSync(src, dest, { recursive: true });
  console.log(`Copied build -> ${outDir}`);
}

function inlineAssetsAndPrune(buildDir, finalFilename) {
  const indexPath = path.join(buildDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('index.html not found in ' + buildDir);
  }

  let html = fs.readFileSync(indexPath, 'utf8');

  // Inline CSS <link> tags
  html = html.replace(/<link[^>]+href="([^"]+\.css)"[^>]*>/g, (match, href) => {
    const cssPath = path.join(buildDir, href);
    if (fs.existsSync(cssPath)) {
      const css = fs.readFileSync(cssPath, 'utf8');
      return `<style>${css}</style>`;
    }
    return match;
  });

  // Inline JS <script src=> tags
  const jsContents = [];
  html = html.replace(/<script([^>]*)src="([^"]+\.js)"([^>]*)><\/script>/g, (match, beforeAttrs, src, afterAttrs) => {
    const jsPath = path.join(buildDir, src);
    if (fs.existsSync(jsPath)) {
      let js = fs.readFileSync(jsPath, 'utf8');
      js = js.replace(/<\/script>/gi, '<\\/script>');
      js = js.replace(/<!--/g, '<\\!--');
      jsContents.push(js);
      return '';
    }
    return match;
  });

  if (jsContents.length > 0) {
    const combinedJs = jsContents.join('\n\n');

    const rawCloseScriptMatch = combinedJs.match(/<\/script>/i);
    const rawHtmlCommentMatch = combinedJs.match(/<!--/);
    if (rawCloseScriptMatch || rawHtmlCommentMatch) {
      const problem = rawCloseScriptMatch ? '</script>' : '<!--';
      const idx = (rawCloseScriptMatch ? rawCloseScriptMatch.index : rawHtmlCommentMatch.index) || 0;
      const contextStart = Math.max(0, idx - 60);
      const contextEnd = Math.min(combinedJs.length, idx + 60);
      const snippet = combinedJs.substring(contextStart, contextEnd).replace(/\n/g, '\\n');
      console.warn(`Inliner found raw \`${problem}\` inside generated JS. Attempting to escape and continue. Context: ...${snippet}...`);
    }

    const sanitizer = (s) => {
      return s
        .replace(/<\/(body)\b/gi, '<\\/$1')
        .replace(/<\/(html)\b/gi, '<\\/$1')
        .replace(/<\/(head)\b/gi, '<\\/$1')
        .replace(/<\/(div)\b/gi, '<\\/$1')
        .replace(/<\/(section)\b/gi, '<\\/$1')
        .replace(/<\/(article)\b/gi, '<\\/$1');
    };

    const sanitizedJs = sanitizer(combinedJs);
    const b64 = Buffer.from(sanitizedJs, 'utf8').toString('base64');
    const loader = `(function(){try{var b='${b64}';var bin=atob(b);try{var arr=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);var blob=new Blob([arr],{type:'text/javascript'});var url=URL.createObjectURL(blob);var s=document.createElement('script');s.src=url;document.body.appendChild(s);}catch(e){try{var txt=decodeURIComponent(escape(bin));var s2=document.createElement('script');s2.text=txt;document.body.appendChild(s2);}catch(e2){var s3=document.createElement('script');s3.text=bin;document.body.appendChild(s3);}}}catch(err){console.error('inlined loader error',err);}})();`;
    const combined = `<script>${loader}</script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${combined}</body>`);
    } else {
      html = html + combined;
    }
  }

  const outPath = path.join(buildDir, finalFilename);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`✓ Wrote inlined HTML: ${outPath}`);

  const staticDir = path.join(buildDir, 'static');
  try {
    if (fs.existsSync(staticDir)) fs.rmSync(staticDir, { recursive: true, force: true });
    if (fs.existsSync(indexPath)) fs.rmSync(indexPath, { force: true });
    console.log(`✓ Cleaned up static assets and original index.html`);
  } catch (err) {
    console.warn('Failed to remove static assets:', err);
  }
}

// --- Main Execution Loop ---
(async function main() {
  console.log('=== Starting Multi-App Build Process ===\n');
  
  try {
    apps.forEach((app, index) => {
      console.log(`\n[${index + 1}/${apps.length}] Processing: ${app.name}`);
      
      // Use app.name as the BUILD_TARGET
      const target = app.name;
      
      // Generate output directory from app name
      const outDir = `build-${app.name}`;
      
      // Use htmlFile from config
      const finalFilename = app.htmlFile;
      
      runBuild(target);
      copyBuild(outDir);
      inlineAssetsAndPrune(path.resolve(process.cwd(), outDir), finalFilename);
      
      console.log(`✓ Successfully packaged ${app.name} → ${outDir}/${finalFilename}`);
    });
    
    console.log('\n=== ✓ All builds completed successfully! ===\n');
  } catch (err) {
    console.error('✗ Build process failed:', err);
    process.exit(1);
  }
})();