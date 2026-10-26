// Publishes the static copy (dist-pages, built by `npm run build:pages`) to the gh-pages branch.
// GitHub Pages serves that branch at https://ivanugrinpsru.ru (CNAME below).
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist-pages');
const git = (args, cwd = out) => execFileSync('git', args, { cwd, stdio: 'inherit' });

if (!existsSync(resolve(out, 'index.html'))) throw new Error('dist-pages is empty: run `npm run build:pages` first.');
const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim();

// GitHub Pages would otherwise skip files and folders that start with "_".
writeFileSync(resolve(out, '.nojekyll'), '');
// The site's own domain: GitHub Pages serves the copy at https://ivanugrinpsru.ru.
writeFileSync(resolve(out, 'CNAME'), 'ivanugrinpsru.ru\n');
// A fresh one-commit branch each time: the copy is rebuilt from source, its history is not needed.
rmSync(resolve(out, '.git'), { recursive: true, force: true });
git(['init', '-q', '-b', 'gh-pages']);
git(['add', '-A']);
git(['-c', 'user.name=Ivan Ugrin site', '-c', 'user.email=noreply@github.com', 'commit', '-q', '-m', 'Static copy for GitHub Pages']);
git(['push', '-f', remote, 'gh-pages']);
rmSync(resolve(out, '.git'), { recursive: true, force: true });
console.log('Published: https://ivanugrinpsru.ru/');
