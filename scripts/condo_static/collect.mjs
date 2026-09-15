// Copy one export build's output into the layout the Workers serve.
//
//   node scripts/condo_static/collect.mjs <web/.next> <out>
//
// <out>/<lang>/<lang>/condo/<slug>.html   one file per rendered page
// <out>/cfs/cfs/_next/static/...          the build's JS/CSS (assetPrefix /cfs)
//
// Each top-level directory is one Worker's assets root, and an asset's path
// under it is its URL path, hence the doubled segment.
//
// A page whose .meta records a non-200 status is skipped, not copied: that is
// notFound() firing mid-build (a Supabase error resolves the slug to nothing),
// and shipping it would replace a good page in the store with a 404 body.
// Skipping keeps the previous version. The count is printed so a bad run is
// visible, and the run fails if more than 2% of pages were skipped.
import fs from "node:fs";
import path from "node:path";

const [nextDir, outDir] = process.argv.slice(2);
if (!nextDir || !outDir) {
  console.error("usage: collect.mjs <web/.next> <out>");
  process.exit(2);
}

let copied = 0;
const skipped = [];
for (const lang of ["en", "ko", "th"]) {
  const src = path.join(nextDir, "server", "app", lang, "condo");
  if (!fs.existsSync(src)) continue;
  const dst = path.join(outDir, lang, lang, "condo");
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (!name.endsWith(".html")) continue;
    const metaPath = path.join(src, name.replace(/\.html$/, ".meta"));
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};
    if (meta.status && meta.status !== 200) {
      skipped.push(`${lang}/${name} (${meta.status})`);
      continue;
    }
    fs.copyFileSync(path.join(src, name), path.join(dst, name));
    copied++;
  }
}

fs.cpSync(path.join(nextDir, "static"), path.join(outDir, "cfs", "cfs", "_next", "static"), {
  recursive: true,
});

console.log(`[collect] copied ${copied} pages, skipped ${skipped.length}`);
for (const s of skipped.slice(0, 20)) console.log(`   skipped ${s}`);
if (copied + skipped.length > 0 && skipped.length / (copied + skipped.length) > 0.02) {
  console.error("[collect] more than 2% of pages were not 200 -- failing the run");
  process.exit(1);
}
