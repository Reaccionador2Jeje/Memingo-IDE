"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const LANGUAGE_SERVERS = Object.freeze({
  javascript:{command:"typescript-language-server",args:["--stdio"],languageId:"javascript",install:"npm install -g typescript typescript-language-server"},
  typescript:{command:"typescript-language-server",args:["--stdio"],languageId:"typescript",install:"npm install -g typescript typescript-language-server"},
  jsx:{command:"typescript-language-server",args:["--stdio"],languageId:"javascript",install:"npm install -g typescript typescript-language-server"},
  tsx:{command:"typescript-language-server",args:["--stdio"],languageId:"typescriptreact",install:"npm install -g typescript typescript-language-server"},
  python:{command:"pyright-langserver",args:["--stdio"],languageId:"python",install:"npm install -g pyright"},
  go:{command:"gopls",args:["serve"],languageId:"go",install:"go install golang.org/x/tools/gopls@latest"},
  rust:{command:"rust-analyzer",args:[],languageId:"rust",install:"Instala rust-analyzer desde https://rust-analyzer.github.io/"},
  c:{command:"clangd",args:["--background-index"],languageId:"c",install:"Instala clangd desde https://clangd.llvm.org/"},
  cpp:{command:"clangd",args:["--background-index"],languageId:"cpp",install:"Instala clangd desde https://clangd.llvm.org/"},
  html:{command:"vscode-html-language-server",args:["--stdio"],languageId:"html",install:"npm install -g vscode-langservers-extracted"},
  css:{command:"vscode-css-language-server",args:["--stdio"],languageId:"css",install:"npm install -g vscode-langservers-extracted"},
  scss:{command:"vscode-css-language-server",args:["--stdio"],languageId:"scss",install:"npm install -g vscode-langservers-extracted"},
  json:{command:"vscode-json-language-server",args:["--stdio"],languageId:"json",install:"npm install -g vscode-langservers-extracted"}
});
function getLanguageServer(id){return Object.hasOwn(LANGUAGE_SERVERS,id)?LANGUAGE_SERVERS[id]:null;}
function listLanguageServers(){return Object.entries(LANGUAGE_SERVERS).map(([languageId,s])=>({languageId,command:s.command,install:s.install}));}
class LspClient{
 constructor(onEvent=()=>{}){this.onEvent=onEvent;this.child=null;this.buffer=Buffer.alloc(0);this.pending=new Map();this.nextId=1;this.document=null;this.version=0;}
 emit(e){try{this.onEvent(e);}catch{}}
 send(m){if(!this.child||!this.child.stdin.writable)throw new Error("El servidor LSP no está conectado.");const b=Buffer.from(JSON.stringify(m));this.child.stdin.write(Buffer.concat([Buffer.from("Content-Length: "+b.length+"\r\n\r\n"),b]));}
 request(method,params,timeout=30000){const id=this.nextId++;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error("El servidor LSP no respondió a "+method+"."));},timeout);this.pending.set(id,{resolve,reject,timer});try{this.send({jsonrpc:"2.0",id,method,params});}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});}
 receive(m){if(m.id!==undefined&&(m.result!==undefined||m.error!==undefined)){const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message||"Error LSP.")):p.resolve(m.result);}return;}if(m.method==="textDocument/publishDiagnostics")this.emit({type:"lsp.diagnostics",uri:m.params?.uri,diagnostics:m.params?.diagnostics||[]});else if(m.method==="window/logMessage"||m.method==="window/showMessage")this.emit({type:"lsp.message",message:m.params?.message||""});}
 parse(){while(true){const i=this.buffer.indexOf("\r\n\r\n");if(i<0)return;const h=this.buffer.subarray(0,i).toString("ascii"),match=/Content-Length:\s*(\d+)/i.exec(h);if(!match){this.buffer=this.buffer.subarray(i+4);continue;}const n=Number(match[1]),start=i+4;if(!Number.isSafeInteger(n)||n<0||n>16*1024*1024){this.emit({type:"lsp.error",message:"Mensaje LSP demasiado grande o inválido."});this.stop();return;}if(this.buffer.length<start+n)return;const body=this.buffer.subarray(start,start+n).toString("utf8");this.buffer=this.buffer.subarray(start+n);try{this.receive(JSON.parse(body));}catch{this.emit({type:"lsp.error",message:"Mensaje JSON-RPC LSP inválido."});}}}
 rejectPending(error){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
 async start(id,root){const def=getLanguageServer(id);if(!def)return{supported:false,message:"No hay servidor LSP configurado para este lenguaje."};await this.stop();const child=spawn(process.platform==="win32"?def.command+".cmd":def.command,def.args,{cwd:root,windowsHide:true,shell:false,stdio:["pipe","pipe","pipe"]});this.child=child;this.buffer=Buffer.alloc(0);child.stdout.on("data",d=>{if(this.child===child){this.buffer=Buffer.concat([this.buffer,d]);this.parse();}});child.stderr.on("data",d=>this.emit({type:"lsp.log",message:d.toString().slice(0,3000)}));child.on("error",e=>{if(this.child===child){this.emit({type:"lsp.error",message:e.code==="ENOENT"?"No se encontró "+def.command+". Instálalo con: "+def.install:e.message});this.stop();}});child.on("exit",code=>{if(this.child===child){this.child=null;this.document=null;this.rejectPending(new Error("El servidor LSP terminó (código "+code+")."));this.emit({type:"lsp.stopped",code});}});try{await this.request("initialize",{processId:process.pid,rootUri:pathToFileURL(root+path.sep).href,workspaceFolders:[{uri:pathToFileURL(root+path.sep).href,name:path.basename(root)}],capabilities:{textDocument:{synchronization:{didSave:true},completion:{completionItem:{snippetSupport:false}},hover:{contentFormat:["plaintext","markdown"]},definition:{linkSupport:true},references:{},rename:{prepareSupport:true},codeAction:{codeActionLiteralSupport:{codeActionKind:{valueSet:["quickfix","refactor","source","source.organizeImports"]}},isPreferredSupport:true}}},clientInfo:{name:"Memingo IDE",version:"0.2.0"}},45000);this.send({jsonrpc:"2.0",method:"initialized",params:{}});this.emit({type:"lsp.started",languageId:id,command:def.command});return{supported:true,connected:true,command:def.command};}catch(e){await this.stop();throw e;}}
 open(filePath,id,text){const uri=pathToFileURL(filePath).href;this.document={uri,languageId:getLanguageServer(id)?.languageId||id};this.version=1;this.send({jsonrpc:"2.0",method:"textDocument/didOpen",params:{textDocument:{uri,languageId:this.document.languageId,version:1,text}}});}
 change(text){if(!this.document)return;this.version++;this.send({jsonrpc:"2.0",method:"textDocument/didChange",params:{textDocument:{uri:this.document.uri,version:this.version},contentChanges:[{text}]}});}
 positionRequest(method,position,extra={}){
  if(!this.child||!this.document)throw new Error("No hay un documento LSP activo.");
  const line=Number(position?.line),character=Number(position?.character);
  if(!Number.isInteger(line)||!Number.isInteger(character)||line<0||character<0||line>1000000||character>1000000)throw new Error("La posición del cursor no es válida.");
  return this.request(method,{textDocument:{uri:this.document.uri},position:{line,character},...extra});
 }
 async completion(position){
  const result=await this.positionRequest("textDocument/completion",position,{context:{triggerKind:1}});
  const items=Array.isArray(result)?result:(Array.isArray(result?.items)?result.items:[]);
  return items.slice(0,100).map(item=>({label:String(item.label||"").slice(0,300),detail:String(item.detail||item.kind||"").slice(0,500),insertText:String(item.insertText||item.label||"").slice(0,2000),insertTextFormat:item.insertTextFormat===2?2:1,textEdit:item.textEdit||null,kind:item.kind||0,sortText:String(item.sortText||"").slice(0,300)})).filter(item=>item.label);
 }
 async hover(position){
  const result=await this.positionRequest("textDocument/hover",position);
  if(!result)return null;
  const contents=result.contents;
  const value=Array.isArray(contents)?contents.map(item=>typeof item==="string"?item:item?.value||"").join("\\n"):typeof contents==="string"?contents:contents?.value||"";
  return {contents:String(value).slice(0,12000),range:result.range||null};
 }
 async definition(position){return this.positionRequest("textDocument/definition",position);}
 async references(position){return this.positionRequest("textDocument/references",position,{context:{includeDeclaration:true}});}
 async rename(position,newName){
  if(typeof newName!=="string"||!newName.trim()||newName.length>256||/[\r\n\0]/.test(newName))throw new Error("El nuevo nombre no es válido.");
  return this.positionRequest("textDocument/rename",position,{newName:newName.trim()});
 }
 async codeAction(range,diagnostics=[]){
  if(!this.child||!this.document)throw new Error("No hay un documento LSP activo.");
  const valid=p=>Number.isInteger(p?.line)&&Number.isInteger(p?.character)&&p.line>=0&&p.character>=0;
  const start=valid(range?.start)?range.start:{line:0,character:0};
  const end=valid(range?.end)?range.end:start;
  const safeDiagnostics=Array.isArray(diagnostics)?diagnostics.slice(0,50).map(item=>({range:item.range||{start,end},severity:item.severity,message:String(item.message||"").slice(0,2000),source:String(item.source||"").slice(0,100)})):[];
  const result=await this.request("textDocument/codeAction",{textDocument:{uri:this.document.uri},range:{start,end},context:{diagnostics:safeDiagnostics}});
  return (Array.isArray(result)?result:[]).slice(0,50).map(item=>({title:String(item.title||"Acción").slice(0,300),kind:String(item.kind||"").slice(0,100),edit:item.edit||null,command:item.command||null,disabled:item.disabled||null}));
 }
 async stop(){const child=this.child;if(!child){this.rejectPending(new Error("Servidor LSP detenido."));return;}this.child=null;this.document=null;try{child.kill();}catch{}this.rejectPending(new Error("Servidor LSP detenido."));}
}
module.exports={LANGUAGE_SERVERS,LspClient,getLanguageServer,listLanguageServers};
