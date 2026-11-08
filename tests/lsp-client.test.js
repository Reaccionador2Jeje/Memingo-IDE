"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {getLanguageServer,listLanguageServers,LspClient}=require("../src/languages/lsp-client");
test("servidores LSP para lenguajes comunes",()=>{for(const id of ["javascript","typescript","python","go","rust","c","cpp","html","css","json"])assert.ok(getLanguageServer(id),id);assert.ok(listLanguageServers().length>=10);});
test("rechaza lenguajes no configurados",()=>{assert.equal(getLanguageServer("memingo"),null);assert.equal(getLanguageServer("__proto__"),null);assert.equal(getLanguageServer("unknown"),null);});
test("cliente inicia desconectado",()=>{const c=new LspClient();assert.equal(c.child,null);assert.equal(c.document,null);});
