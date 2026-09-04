const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

function zipDirectory(sourceDir, outPath) {
  const archive = archiver('zip', { zlib: { level: 9 }});
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    archive
      .directory(sourceDir, false)
      .on('error', err => reject(err))
      .pipe(stream)
    ;

    stream.on('close', () => resolve());
    archive.finalize();
  });
}

(async () => {
    await zipDirectory(path.join(__dirname, 'Chrome_Extensions/AutoScope'), path.join(__dirname, 'Chrome_Extensions/AutoScope.zip'));
    await zipDirectory(path.join(__dirname, 'Chrome_Extensions/Field_Filler'), path.join(__dirname, 'Chrome_Extensions/Field_Filler.zip'));
    await zipDirectory(path.join(__dirname, 'Chrome_Extensions/LLM_Exporter'), path.join(__dirname, 'Chrome_Extensions/LLM_Exporter.zip'));
    console.log("Zipping complete!");
})();
