// usage: node fix-uris.cjs <in.glb> <searchDir> <workDir>
// Copies the GLB into workDir with every external image resolved by basename
// (case-insensitive) from searchDir; unresolvable ones point at white.png.
const fs = require("fs"), path = require("path");
const [inp, searchDir, work] = process.argv.slice(2);
fs.mkdirSync(work, { recursive: true });
const index = {};
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : (index[e.name.toLowerCase()] = p); } })(searchDir);
fs.copyFileSync(path.join(__dirname, "ArchiCADmodel", "white.png"), path.join(work, "white.png"));
const b = fs.readFileSync(inp), len = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + len).toString());
let found = 0, missing = [];
for (const img of j.images || []) {
  if (!img.uri) continue;
  const base = decodeURIComponent(img.uri).split(/[\/]/).pop();
  const hit = index[base.toLowerCase()];
  if (hit) { fs.copyFileSync(hit, path.join(work, base)); img.uri = encodeURI(base); found++; }
  else { missing.push(base); img.uri = "white.png"; }
}
let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
const bin = b.slice(20 + len), h = Buffer.alloc(20);
h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(20 + js.length + bin.length, 8); h.writeUInt32LE(js.length, 12); h.writeUInt32LE(0x4E4F534A, 16);
fs.writeFileSync(path.join(work, "in.glb"), Buffer.concat([h, js, bin]));
console.log(path.basename(work), "textures found:", found, "missing → white:", missing.length, missing.slice(0, 4));
