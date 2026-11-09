"use strict";
(function (root) {
  const KEYWORDS = ["vibe","ritual","drop","when","nah","grind","spill","borrow","based","cringe","ghost","whole","caption","party"];
  const BUILTINS = ["headcount","whatkind","json_parse","json_stringify","env","range","keys","push","append","set_value","delete_key","random","random_int","http_get","http_post","trim","split","join","sort","map","filter","reduce","sum","min","max","clamp","parse_int","parse_float","repeat","lines","unique","meme_case","shuffle","uuid","now","sleep","read_file","write_file","file_exists","list_files"];
  const HELP = Object.fromEntries(KEYWORDS.map(word => [word, "Palabra clave del lenguaje Memingo."]));
  for (const word of BUILTINS) HELP[word] = "Función integrada de Memingo.";
  function analyze(source) {
    source = String(source || "");
    const diagnostics = [], stack = [];
    let quote = null, escaped = false, line = 0, column = 0, comment = false;
    const pairs = {")":"(","]":"[","}":"{"};
    for (let i=0;i<source.length;i++) {
      const ch=source[i];
      if (ch==="\n") { line++; column=0; comment=false; continue; }
      if (comment) { column++; continue; }
      if (quote) {
        if (escaped) escaped=false;
        else if (ch==="\\") escaped=true;
        else if (ch===quote) quote=null;
        column++; continue;
      }
      if (ch==="#" ) { comment=true; column++; continue; }
      if (ch==='"'||ch==="'") { quote=ch; column++; continue; }
      if ("([{".includes(ch)) stack.push({ch,line,column});
      else if (")]}".includes(ch)) {
        const last=stack.pop();
        if (!last || last.ch!==pairs[ch]) diagnostics.push({line,column,severity:1,message:"Delimitador "+ch+" sin pareja"});
      }
      column++;
    }
    if (quote) diagnostics.push({line,column,severity:1,message:"Cadena sin cerrar"});
    for (const item of stack) diagnostics.push({line:item.line,column:item.column,severity:1,message:"Falta cerrar "+item.ch});
    return diagnostics;
  }
  function symbols(source) {
    const result=[];
    String(source||"").split("\n").forEach((text,line)=>{
      const match=text.match(/^\s*(?:vibe|ritual)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if(match) result.push({name:match[1],line,kind:text.trimStart().startsWith("ritual")?"function":"variable"});
    });
    return result;
  }
  function complete(source,prefix) {
    const local=symbols(source).map(item=>item.name);
    const all=[...KEYWORDS,...BUILTINS,...local];
    const normalized=String(prefix||"").toLowerCase();
    return [...new Set(all)].filter(word=>!normalized||word.toLowerCase().startsWith(normalized)).slice(0,30)
      .map(label=>({label,detail:HELP[label]||"Símbolo del proyecto"}));
  }
  function hover(source,word) {
    if(HELP[word]) return HELP[word];
    const item=symbols(source).find(entry=>entry.name===word);
    return item ? (item.kind==="function"?"Ritual (función)":"Variable")+" declarada en la línea "+(item.line+1)+".":null;
  }
  root.MemingoMobileLSP=Object.freeze({analyze,symbols,complete,hover,keywords:KEYWORDS,builtins:BUILTINS});
})(typeof globalThis!=="undefined"?globalThis:this);
