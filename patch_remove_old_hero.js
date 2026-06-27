const fs = require("fs");
let html = fs.readFileSync("public/index.html", "utf8");

const oldStart = '<div class="logo-wrap" style="margin-bottom:20px;padding-top:8px;">';
const oldEnd = '</div>\n\n<div class="commerce-feed" id="seccion-comercios">';
const replacement = '\n<div class="commerce-feed" id="seccion-comercios">';

const idxStart = html.indexOf(oldStart);
const idxEnd = html.indexOf(oldEnd);

if (idxStart !== -1 && idxEnd !== -1 && idxStart < idxEnd) {
  html = html.slice(0, idxStart) + replacement + html.slice(idxEnd + oldEnd.length);
  fs.writeFileSync("public/index.html", html);
  console.log("OK bloque viejo eliminado (lineas 668-780)");
} else {
  console.log("ERROR: no se encontro el bloque completo - start:" + idxStart + " end:" + idxEnd);
}
