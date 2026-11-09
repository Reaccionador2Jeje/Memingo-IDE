"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {getLanguageServer,listLanguageServers,LspClient}=require("../src/languages/lsp-client");
test("servidores LSP para lenguajes comunes",()=>{for(const id of ["memingo","javascript","typescript","python","go","rust","c","cpp","html","css","json"])assert.ok(getLanguageServer(id),id);assert.ok(listLanguageServers().length>=10);});
test("rechaza lenguajes no configurados",()=>{assert.equal(getLanguageServer("memingo").command,"memingo");assert.equal(getLanguageServer("__proto__"),null);assert.equal(getLanguageServer("unknown"),null);});
test("cliente inicia desconectado",()=>{const c=new LspClient();assert.equal(c.child,null);assert.equal(c.document,null);});

test("completion normaliza CompletionList y limita los resultados",async()=>{
 const c=new LspClient();c.child={};c.document={uri:"file:///project/a.js"};
 c.request=async(method,params)=>{assert.equal(method,"textDocument/completion");assert.equal(params.position.line,2);return{items:[{label:"console.log",detail:"method"},{label:"next"}]};};
 const items=await c.completion({line:2,character:4});assert.equal(items.length,2);assert.equal(items[0].label,"console.log");
});
test("hover extrae contenido de MarkupContent",async()=>{
 const c=new LspClient();c.child={};c.document={uri:"file:///project/a.py"};
 c.request=async()=>({contents:{kind:"markdown",value:"**int** count"}});
 assert.equal((await c.hover({line:0,character:1})).contents,"**int** count");
});
test("definition y references usan el documento activo",async()=>{
 const c=new LspClient();c.child={};c.document={uri:"file:///project/a.go"};let methods=[];
 c.request=async(method,params)=>{methods.push(method);assert.equal(params.textDocument.uri,c.document.uri);return[];};
 await c.definition({line:0,character:0});await c.references({line:0,character:0});
 assert.deepEqual(methods,["textDocument/definition","textDocument/references"]);
});
test("rename valida el nombre antes de enviar",async()=>{
 const c=new LspClient();c.child={};c.document={uri:"file:///project/a.rs"};let sent=false;
 c.request=async()=>{sent=true;return{};};
 await assert.rejects(c.rename({line:0,character:0},"bad\nname"));
 assert.equal(sent,false);
 await c.rename({line:0,character:0},"newName");assert.equal(sent,true);
});
test("code actions solicita acciones para el documento activo",async()=>{
 const c=new LspClient();c.child={};c.document={uri:"file:///project/a.ts"};
 c.request=async(method,params)=>{assert.equal(method,"textDocument/codeAction");assert.equal(params.textDocument.uri,c.document.uri);return[{title:"Fix import",kind:"quickfix",edit:{changes:{}}}];};
 const actions=await c.codeAction({start:{line:0,character:0},end:{line:0,character:3}},[]);
 assert.equal(actions[0].title,"Fix import");
});
test("las peticiones LSP rechazan posiciones inválidas",async()=>{
 const c=new LspClient();c.child={};c.document={uri:"file:///project/a.js"};
 await assert.rejects(c.hover({line:-1,character:0}));
});

test("Windows launches command shim servers through the platform shell",()=>{
 const fs=require("node:fs");
 const source=fs.readFileSync(require.resolve("../src/languages/lsp-client"),"utf8");
 assert.match(source,/shell:windows/);
});
