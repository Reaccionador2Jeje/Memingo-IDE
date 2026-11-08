"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { getLanguageByExtension, getLanguageByFileName, listLanguages, getSupportedExtensions } = require("../src/languages/registry");

test("el catálogo incluye una colección amplia y extensible", () => {
  assert.ok(listLanguages().length >= 100);
  assert.ok(getSupportedExtensions().length >= 130);
});
test("reconoce lenguajes web, generales, sistemas, datos y videojuegos", () => {
  const cases = [["mgo","memingo"],["js","javascript"],["ts","typescript"],["py","python"],["rs","rust"],["go","go"],["java","java"],["cpp","cpp"],["cs","csharp"],["html","html"],["css","css"],["json","json"],["sql","sql"],["gd","godot"],["gdshader","gdshader"],["sol","solidity"],["wat","wasm"],["ipynb","python"],["gleam","gleam"],["cue","cue"],["bicep","bicep"],["qs","qsharp"]];
  for (const [extension,expected] of cases) assert.equal(getLanguageByExtension(extension).id,expected,extension);
});
test("reconoce nombres especiales y extensiones compuestas", () => {
  const cases = [["Dockerfile","dockerfile"],["Containerfile","dockerfile"],["Makefile","makefile"],["CMakeLists.txt","cmake"],[".gitignore","gitignore"],[".env.local","env"],["package-lock.json","lock"],["build.gradle.kts","gradle"],["main.d.ts","typescript"],["Taskfile.yml","taskfile"]];
  for (const [name,expected] of cases) assert.equal(getLanguageByFileName(name).id,expected,name);
});
test("los alias se agrupan y las extensiones ambiguas son deterministas", () => {
  assert.ok(listLanguages().find(x=>x.id==="python").extensions.includes("ipynb"));
  assert.equal(getLanguageByExtension("v").id,"verilog");
  assert.equal(getLanguageByExtension("m").id,"matlab");
  assert.equal(getLanguageByExtension("pl").id,"perl");
});
test("lo desconocido queda como texto plano", () => {
  assert.equal(getLanguageByExtension("unknown-ext").id,"plaintext");
  assert.equal(getLanguageByExtension(".js").id,"javascript");
});
