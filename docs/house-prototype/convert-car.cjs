// usage: node convert-car.cjs <model.fbx> <out.glb> <textureDir...>
const fs = require("fs"), path = require("path");
const [model, out, ...texDirs] = process.argv.slice(2);
require("assimpjs")().then((ajs) => {
  const files = new ajs.FileList();
  files.AddFile(path.basename(model), new Uint8Array(fs.readFileSync(model)));
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    if (/\.(png|jpe?g)$/i.test(e.name)) files.AddFile(e.name, new Uint8Array(fs.readFileSync(p)));
  });
  texDirs.forEach(walk);
  const r = ajs.ConvertFileList(files, "glb2");
  if (!r.IsSuccess() || r.FileCount() === 0) { console.error("FAILED", r.GetErrorCode()); process.exit(1); }
  fs.writeFileSync(out, r.GetFile(0).GetContent());
  console.log(path.basename(out), (fs.statSync(out).size / 1e6).toFixed(1) + "MB");
});
