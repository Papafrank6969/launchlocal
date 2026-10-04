const fs = require("fs");
const path = require("path");
require("assimpjs")().then((ajs) => {
  const dir = path.join(__dirname, "kmz", "models");
  const files = new ajs.FileList();
  files.AddFile("ArchiCADmodel.dae", new Uint8Array(fs.readFileSync(path.join(dir, "ArchiCADmodel.dae"))));
  for (const f of fs.readdirSync(path.join(dir, "ArchiCADmodel"))) {
    files.AddFile(`ArchiCADmodel/${f}`, new Uint8Array(fs.readFileSync(path.join(dir, "ArchiCADmodel", f))));
  }
  const result = ajs.ConvertFileList(files, "glb2");
  if (!result.IsSuccess() || result.FileCount() === 0) {
    console.error("convert failed:", result.GetErrorCode());
    process.exit(1);
  }
  const out = result.GetFile(0);
  fs.writeFileSync(path.join(__dirname, "raw.glb"), out.GetContent());
  console.log("wrote raw.glb", out.GetContent().length, "bytes");
});
