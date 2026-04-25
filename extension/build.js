const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');
const target = process.env.TARGET || 'chrome';

const buildOptions = {
  entryPoints: {
    'background/background': 'src/background/background.ts',
    'content/index': 'src/content/index.ts',
    'popup/popup': 'src/popup/popup.ts',
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'chrome120',
};

async function build() {
  // очистить dist
  if (fs.existsSync('dist')) {
    fs.rmdirSync('dist', { recursive: true, force: true });
  }
  fs.mkdirSync('dist', { recursive: true });

  // собрать JS
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching...');
  } else {
    await esbuild.build(buildOptions);
  }

  // скопировать статику
  if (fs.existsSync('manifest.json')) {
    fs.copyFileSync('manifest.json', 'dist/manifest.json');
  } else {
    console.error('manifest.json not found');
    process.exit(1);
  }

  if (fs.existsSync('src/popup/popup.html')) {
    fs.copyFileSync('src/popup/popup.html', 'dist/popup/popup.html');
  } else {
    console.error('src/popup/popup.html not found');
    process.exit(1);
  }

  copyDir('assets', 'dist/assets');

  // Firefox overrides
  if (target === 'firefox') {
    if (fs.existsSync('manifest.json') && fs.existsSync('manifest.firefox.json')) {
      const base = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
      const overrides = JSON.parse(fs.readFileSync('manifest.firefox.json', 'utf8'));
      fs.writeFileSync('dist/manifest.json', JSON.stringify({ ...base, ...overrides }, null, 2));
    } else {
      console.error('Cannot apply Firefox overrides: missing manifest files');
      process.exit(1);
    }
  }

  console.log(`Built for ${target}`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

build().catch(console.error);
