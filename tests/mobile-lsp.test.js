"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
require("../mobile/memingo-lsp.js");
const lsp=globalThis.MemingoMobileLSP;

test("mobile diagnostics report mismatched delimiters",()=>{
 const items=lsp.analyze("vibe value = (2]");
 assert.ok(items.some(item=>item.message.includes("Delimitador")));
});
test("mobile diagnostics ignore delimiters inside strings and comments",()=>{
 assert.deepEqual(lsp.analyze('spill "([)]" # comment (\n'),[]);
});
test("mobile completion includes builtins and project symbols",()=>{
 const items=lsp.complete("vibe score = 2","s");
 const labels=items.map(item=>item.label);
 assert.ok(labels.includes("score"));
 assert.ok(labels.includes("json_parse")===false);
});
test("mobile hover explains keywords and declared symbols",()=>{
 assert.match(lsp.hover("vibe score = 2","score"),/Variable declarada/);
 assert.match(lsp.hover("","ritual"),/Palabra clave/);
});
test("mobile symbols identify rituals",()=>{
 assert.deepEqual(lsp.symbols("ritual greet() {\n}\nvibe score = 1").map(item=>item.kind),["function","variable"]);
});
