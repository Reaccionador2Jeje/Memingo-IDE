"use strict";

// Catálogo de lenguajes y formatos editables por Memingo IDE.
// La edición no depende de que el compilador o runtime esté instalado.
const DEFINITIONS = [
  ["memingo","Memingo",["mgo","mgoa"],"memingo"],
  ["javascript","JavaScript",["js","mjs","cjs"],"script"],
  ["typescript","TypeScript",["ts","mts","cts"],"script"],
  ["jsx","React JSX",["jsx"],"script"],
  ["tsx","React TSX",["tsx"],"script"],
  ["python","Python",["py","pyw","pyi"],"script"],
  ["python","Jupyter Python",["ipynb"],"data"],
  ["java","Java",["java"],"c"],
  ["kotlin","Kotlin",["kt","kts"],"c"],
  ["scala","Scala",["scala","sc"],"c"],
  ["groovy","Groovy",["groovy","gradle"],"c"],
  ["clojure","Clojure",["clj","cljs","cljc","edn"],"lisp"],
  ["ruby","Ruby",["rb","rake","gemspec"],"script"],
  ["php","PHP",["php","phtml"],"c"],
  ["go","Go",["go"],"c"],
  ["rust","Rust",["rs"],"c"],
  ["c","C",["c","h"],"c"],
  ["cpp","C++",["cc","cpp","cxx","hpp","hh","hxx"],"c"],
  ["csharp","C#",["cs"],"c"],
  ["fsharp","F#",["fs","fsi","fsx"],"c"],
  ["vb","Visual Basic",["vb"],"c"],
  ["swift","Swift",["swift"],"c"],
  ["objectivec","Objective-C",["m","mm"],"c"],
  ["dart","Dart",["dart"],"c"],
  ["elixir","Elixir",["ex","exs"],"script"],
  ["erlang","Erlang",["erl","hrl"],"script"],
  ["haskell","Haskell",["hs","lhs"],"script"],
  ["ocaml","OCaml",["ml","mli"],"script"],
  ["lua","Lua",["lua"],"script"],
  ["perl","Perl",["pl","pm"],"script"],
  ["r","R",["r","rmd"],"script"],
  ["julia","Julia",["jl"],"script"],
  ["shell","Shell",["sh","bash","zsh","fish"],"script"],
  ["powershell","PowerShell",["ps1","psm1","psd1"],"script"],
  ["batch","Windows Batch",["bat","cmd"],"script"],
  ["html","HTML",["html","htm","xhtml"],"markup"],
  ["xml","XML",["xml","xsd","xsl","xslt","plist"],"markup"],
  ["svg","SVG",["svg"],"markup"],
  ["css","CSS",["css"],"style"],
  ["scss","SCSS",["scss"],"style"],
  ["sass","Sass",["sass"],"style"],
  ["less","Less",["less"],"style"],
  ["json","JSON",["json","jsonc","json5"],"data"],
  ["yaml","YAML",["yaml","yml"],"data"],
  ["toml","TOML",["toml"],"data"],
  ["ini","INI",["ini","cfg","conf","properties"],"data"],
  ["markdown","Markdown",["md","markdown","mdx"],"markdown"],
  ["rst","reStructuredText",["rst"],"markdown"],
  ["latex","LaTeX",["tex","bib"],"markdown"],
  ["sql","SQL",["sql"],"sql"],
  ["graphql","GraphQL",["graphql","gql"],"c"],
  ["proto","Protocol Buffers",["proto"],"c"],
  ["dockerfile","Dockerfile",["dockerfile"],"script"],
  ["makefile","Makefile",["makefile","mk"],"script"],
  ["cmake","CMake",["cmake"],"script"],
  ["nginx","Nginx",["nginx"],"script"],
  ["diff","Diff/Patch",["diff","patch"],"data"],
  ["log","Log",["log"],"data"],
  ["text","Texto plano",["txt","text"],"plain"],
  ["csv","CSV",["csv","tsv"],"data"],
  ["wasm","WebAssembly Text",["wat"],"c"],
  ["assembly","Assembly",["asm","s"],"c"],
  ["solidity","Solidity",["sol"],"c"],
  ["move","Move",["move"],"c"],
  ["vyper","Vyper",["vy"],"script"],
  ["plsql","PL/SQL",["pks","pkb"],"sql"],
  ["powershell","PowerShell Data",["pssc"],"data"],
  ["terraform","Terraform",["tf","tfvars"],"script"],
  ["hcl","HCL",["hcl"],"data"],
  ["nix","Nix",["nix"],"script"],
  ["dhall","Dhall",["dhall"],"data"],
  ["elm","Elm",["elm"],"script"],
  ["purescript","PureScript",["purs"],"script"],
  ["reason","Reason",["re","rei"],"c"],
  ["rescript","ReScript",["res"],"c"],
  ["vue","Vue",["vue"],"markup"],
  ["svelte","Svelte",["svelte"],"markup"],
  ["astro","Astro",["astro"],"markup"],
  ["handlebars","Handlebars",["hbs","handlebars"],"markup"],
  ["pug","Pug",["pug"],"markup"],
  ["stylus","Stylus",["styl"],"style"],
  ["tailwind","Tailwind CSS",["pcss"],"style"],
  ["protobuf","Cap'n Proto",["capnp"],"c"],
  ["fortran","Fortran",["f","for","f90","f95","f03"],"c"],
  ["cobol","COBOL",["cob","cbl"],"c"],
  ["pascal","Pascal",["pas","pp"],"c"],
  ["ada","Ada",["adb","ads"],"c"],
  ["d","D",["d"],"c"],
  ["nim","Nim",["nim"],"script"],
  ["zig","Zig",["zig"],"c"],
  ["v","V",["v"],"c"],
  ["odin","Odin",["odin"],"c"],
  ["crystal","Crystal",["cr"],"script"],
  ["smalltalk","Smalltalk",["st"],"script"],
  ["scheme","Scheme",["scm","ss"],"lisp"],
  ["racket","Racket",["rkt"],"lisp"],
  ["commonlisp","Common Lisp",["lisp","lsp"],"lisp"],
  ["prolog","Prolog",["plg"],"script"],
  ["verilog","Verilog",["v","vh"],"c"],
  ["vhdl","VHDL",["vhd","vhdl"],"c"],
  ["matlab","MATLAB",["m"],"script"],
  ["octave","Octave",["m"],"script"],
  ["opencl","OpenCL",["cl"],"c"],
  ["cuda","CUDA",["cu","cuh"],"c"],
  ["glsl","GLSL",["glsl","vert","frag","geom"],"c"],
  ["hlsl","HLSL",["hlsl","fx"],"c"],
  ["godot","GDScript",["gd"],"script"],
  ["gdshader","Godot Shader",["gdshader"],"c"],
  ["renpy","Ren'Py",["rpy"],"script"],
  ["gml","GameMaker Language",["gml"],"c"],
  ["gdextension","GDExtension",["gdextension"],"data"],
  ["json","JSON Lines",["jsonl","ndjson"],"data"],
  ["graphql","GraphQL Schema",["graphqls"],"c"]
];

const KEYWORDS = {
  script: "if else elif then fi for while do done break continue return yield function async await class extends import from as export default const let var new try catch finally throw raise with in of is not and or match case switch when fn def fun val var pub use mod impl trait struct enum type interface package namespace static public private protected void int float double bool string true false null nil self this super print echo return pass lambda",
  c: "if else for while do break continue return switch case default try catch finally throw class struct enum union typedef namespace using public private protected static const let var fn func function void int long short char float double bool string true false null nullptr self this new delete import include define package public private async await",
  sql: "select from where and or not null is as join inner left right full outer on group by order having limit offset insert into values update set delete create alter drop table database index view primary key foreign references unique check constraint default count sum avg min max distinct union all case when then else end like between in exists",
  lisp: "define lambda let let* if cond begin quote set! define-syntax require provide module import defn defmacro fn loop recur",
  markup: "html head body title meta link script style div span p a img section article header footer main nav button input form label ul ol li table tr td th h1 h2 h3 h4 h5 h6 svg path rect circle"
};

function getLanguageByExtension(extension) {
  const ext = String(extension || "").replace(/^\./, "").toLowerCase();
  for (const [id, name, extensions, category] of DEFINITIONS) {
    if (extensions.includes(ext)) return { id, name, extensions: [...extensions], category, keywords: KEYWORDS[category] || "" };
  }
  return { id: "plaintext", name: "Texto plano", extensions: [], category: "plain", keywords: "" };
}

function listLanguages() {
  const seen = new Set();
  return DEFINITIONS.filter(([id]) => !seen.has(id) && seen.add(id))
    .map(([id, name, extensions, category]) => ({ id, name, extensions: [...extensions], category, keywords: KEYWORDS[category] || "" }));
}

function getSupportedExtensions() {
  return [...new Set(DEFINITIONS.flatMap(([, , extensions]) => extensions))];
}

module.exports = { getLanguageByExtension, listLanguages, getSupportedExtensions };
