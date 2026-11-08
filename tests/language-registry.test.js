"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getLanguageByExtension,
  listLanguages,
  getSupportedExtensions
} = require("../src/languages/registry");

test("el catálogo incluye una colección amplia de lenguajes y formatos", () => {
  assert.ok(listLanguages().length >= 80, "se esperan al menos 80 lenguajes o familias");
  assert.ok(getSupportedExtensions().length >= 100, "se esperan al menos 100 extensiones");
});

test("se reconocen lenguajes populares, web, sistemas y videojuegos", () => {
  const cases = [
    ["mgo", "memingo"],
    ["js", "javascript"],
    ["ts", "typescript"],
    ["py", "python"],
    ["rs", "rust"],
    ["go", "go"],
    ["java", "java"],
    ["cpp", "cpp"],
    ["cs", "csharp"],
    ["html", "html"],
    ["css", "css"],
    ["json", "json"],
    ["sql", "sql"],
    ["gd", "godot"],
    ["gdshader", "gdshader"],
    ["sol", "solidity"],
    ["wat", "wasm"],
    ["ipynb", "python"]
  ];
  for (const [extension, expected] of cases) {
    assert.equal(getLanguageByExtension(extension).id, expected, extension);
  }
});

test("las extensiones de alias se agrupan en el catálogo público", () => {
  const python = listLanguages().find(language => language.id === "python");
  assert.ok(python.extensions.includes("py"));
  assert.ok(python.extensions.includes("ipynb"));
  assert.ok(listLanguages().some(language => language.extensions.includes("tsx")));
});

test("los archivos desconocidos se tratan como texto plano", () => {
  assert.equal(getLanguageByExtension("unknown-ext").id, "plaintext");
  assert.equal(getLanguageByExtension(".js").id, "javascript");
});
