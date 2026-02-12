# Deploying CAMN to GitHub Pages

Your site is currently a single React JSX artifact (~2000 lines). GitHub Pages serves static files, so you need a build step that compiles JSX into plain JavaScript. Below are all the steps.

---

## Option A: Vite + React (recommended)

### 1. Create the project locally

```bash
# Create a new Vite project
npm create vite@latest camn-site -- --template react
cd camn-site

# Install dependencies (only React + Recharts, which the site already uses)
npm install recharts
```

### 2. Replace the default files

Delete everything inside `src/` and replace with your site:

```
camn-site/
  index.html          <-- modify (see below)
  vite.config.js      <-- modify (see below)
  package.json
  public/
    assets/
      papers/
        disabled-expectations.pdf   <-- your research PDF
  src/
    App.jsx            <-- your camn_site_v2.jsx (rename export)
    main.jsx           <-- entry point (see below)
    index.css          <-- empty or minimal reset
```

### 3. File contents

**src/main.jsx**
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**src/App.jsx**
Copy `camn_site_v2.jsx` here. The file already has `export default function App()` so it works as-is.

**index.html** (in project root)
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CAMN - Cheikh Ahmadou Mbacke Ndiaye</title>
    <meta name="description" content="Personal academic site of Cheikh Ahmadou Mbacke Ndiaye. Research in labor economics, subjective expectations, and political economy." />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>F</text></svg>" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**vite.config.js**
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/camn-site/',  // <-- must match your GitHub repo name
})
```

### 4. Test locally

```bash
npm run dev
# Open http://localhost:5173/camn-site/
```

Verify:
- [ ] Fulgurances index shows all 8 posts
- [ ] VIH article renders with interactive simulation
- [ ] IPG article renders with game tree, posterior plot, Monte Carlo
- [ ] Math equations display in LaTeX style (KaTeX loads from CDN)
- [ ] Dark mode toggle works
- [ ] Research page shows "Read Paper" links
- [ ] Music link cards open Spotify/Apple Music

### 5. Build for production

```bash
npm run build
# Output goes to dist/
```

### 6. Deploy to GitHub Pages

**Method A: GitHub Actions (recommended, automatic)**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

Then in your GitHub repo:
1. Go to **Settings > Pages**
2. Under **Source**, select **GitHub Actions**
3. Push to `main` and the site deploys automatically

**Method B: Manual deploy with gh-pages package**

```bash
npm install -D gh-pages

# Add to package.json scripts:
# "deploy": "gh-pages -d dist"

npm run build
npm run deploy
```

Then in GitHub repo Settings > Pages, set source to `gh-pages` branch.

### 7. Your site will be live at

```
https://YOUR_USERNAME.github.io/camn-site/
```

---

## Option B: Custom domain (optional)

If you own a domain (e.g., `camn.dev`):

1. Add a `public/CNAME` file containing your domain:
   ```
   camn.dev
   ```

2. In `vite.config.js`, change `base` to `'/'`

3. In your domain DNS settings, add:
   ```
   CNAME  @  YOUR_USERNAME.github.io
   ```
   or for `www`:
   ```
   CNAME  www  YOUR_USERNAME.github.io
   ```

4. In GitHub repo Settings > Pages > Custom domain, enter your domain

---

## File checklist for your Git commit

```
camn-site/
  .github/
    workflows/
      deploy.yml              <-- GitHub Actions workflow
  public/
    assets/
      papers/
        disabled-expectations.pdf  <-- your research PDF
    CNAME                     <-- only if using custom domain
  src/
    App.jsx                   <-- camn_site_v2.jsx (the full site)
    main.jsx                  <-- 6-line entry point
    index.css                 <-- empty file (styles are inline)
  index.html                  <-- HTML shell
  vite.config.js              <-- Vite config with base path
  package.json                <-- dependencies: react, recharts
  .gitignore                  <-- node_modules, dist
```

### .gitignore
```
node_modules
dist
.DS_Store
```

---

## Important notes

1. **KaTeX**: The site loads KaTeX JS and CSS from `cdnjs.cloudflare.com` at runtime. No npm install needed. It will work on GitHub Pages as long as the user has internet access.

2. **Fonts**: Google Fonts (Playfair Display, Source Serif 4, JetBrains Mono, Libre Franklin) are loaded via `@import` in the inline `<style>` tag. Same CDN dependency.

3. **No backend**: The site is fully static. Comments are in-memory only (reset on page reload). The Monte Carlo simulation runs client-side.

4. **PDF**: Place your research PDF at `public/assets/papers/disabled-expectations.pdf`. Vite copies everything in `public/` to the build output as-is.

5. **File size**: The JSX file is ~200KB. After Vite builds and minifies, the JS bundle will be ~80-120KB gzipped. Recharts adds ~40KB gzipped. Total page load should be under 300KB.

6. **Mobile**: The site is responsive. The IPG article's table of contents hides below 900px viewport width.
