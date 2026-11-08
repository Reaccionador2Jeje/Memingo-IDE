"use strict";

// Catálogo de lenguajes y formatos. La edición y el resaltado no requieren
// que el compilador o runtime del lenguaje esté instalado.
const DEFINITIONS = [
  ["memingo","Memingo",["mgo","mgoa"],"memingo"],
  ["javascript","JavaScript",["js","mjs","cjs"],"script"],
  ["typescript","TypeScript",["ts","mts","cts"],"script",[".d.ts"]],
  ["jsx","React JSX",["jsx"],"script"],
  ["tsx","React TSX",["tsx"],"script"],
  ["python","Python",["py","pyw","pyi","pyx","pxd","pxi"],"script",["SConstruct","wscript"]],
  ["python","Jupyter Python",["ipynb"],"data"],
  ["java","Java",["java"],"c"],
  ["kotlin","Kotlin",["kt","kts"],"c"],
  ["scala","Scala",["scala","sc"],"c"],
  ["groovy","Groovy",["groovy","gradle","gvy"],"c"],
  ["clojure","Clojure",["clj","cljs","cljc","edn"],"lisp"],
  ["ruby","Ruby",["rb","rake","gemspec"],"script"],
  ["php","PHP",["php","phtml","php3","php4","php5"],"c"],
  ["go","Go",["go"],"c"],
  ["rust","Rust",["rs"],"c"],
  ["c","C",["c","h"],"c"],
  ["cpp","C++",["cc","cpp","cxx","hpp","hh","hxx","ipp","tpp"],"c"],
  ["csharp","C#",["cs"],"c"],
  ["fsharp","F#",["fs","fsi","fsx","fsscript"],"c"],
  ["vb","Visual Basic",["vb","vbs"],"c"],
  ["swift","Swift",["swift"],"c"],
  ["objectivec","Objective-C",["m","mm"],"c"],
  ["dart","Dart",["dart"],"c"],
  ["elixir","Elixir",["ex","exs"],"script"],
  ["erlang","Erlang",["erl","hrl"],"script"],
  ["haskell","Haskell",["hs","lhs"],"script"],
  ["ocaml","OCaml",["ml","mli"],"script"],
  ["lua","Lua",["lua"],"script"],
  ["perl","Perl",["pl","pm","t","pod"],"script"],
  ["r","R",["r","rmd"],"script"],
  ["julia","Julia",["jl"],"script"],
  ["shell","Shell",["sh","bash","zsh","fish","ksh"],"script"],
  ["powershell","PowerShell",["ps1","psm1","psd1","pssc"],"script"],
  ["batch","Windows Batch",["bat","cmd"],"script"],
  ["html","HTML",["html","htm","xhtml"],"markup"],
  ["xml","XML",["xml","xsd","xsl","xslt","plist","wsdl","dtd"],"markup"],
  ["svg","SVG",["svg"],"markup"],
  ["css","CSS",["css"],"style"],
  ["scss","SCSS",["scss"],"style"],
  ["sass","Sass",["sass"],"style"],
  ["less","Less",["less"],"style"],
  ["json","JSON",["json","jsonc","json5","jsonl","ndjson"],"data"],
  ["yaml","YAML",["yaml","yml"],"data"],
  ["toml","TOML",["toml"],"data"],
  ["ini","INI",["ini","cfg","conf","properties","editorconfig"],"data"],
  ["markdown","Markdown",["md","markdown","mdx"],"markdown"],
  ["rst","reStructuredText",["rst"],"markdown"],
  ["asciidoc","AsciiDoc",["adoc","asciidoc"],"markdown"],
  ["latex","LaTeX",["tex","bib","sty","cls"],"markdown"],
  ["sql","SQL",["sql"],"sql"],
  ["graphql","GraphQL",["graphql","gql","graphqls"],"c"],
  ["proto","Protocol Buffers",["proto"],"c"],
  ["dockerfile","Dockerfile",["dockerfile"],"script",["Dockerfile","Containerfile"]],
  ["makefile","Makefile",["makefile","mk"],"script",["Makefile","GNUmakefile"]],
  ["cmake","CMake",["cmake"],"script",["CMakeLists.txt"]],
  ["nginx","Nginx",["nginx"],"script",["nginx.conf"]],
  ["diff","Diff/Patch",["diff","patch"],"data"],
  ["log","Log",["log"],"data"],
  ["text","Texto plano",["txt","text"],"plain"],
  ["csv","CSV/TSV",["csv","tsv"],"data"],
  ["wasm","WebAssembly Text",["wat"],"c"],
  ["assembly","Assembly",["asm","s"],"c"],
  ["solidity","Solidity",["sol"],"c"],
  ["move","Move",["move"],"c"],
  ["vyper","Vyper",["vy"],"script"],
  ["plsql","PL/SQL",["pks","pkb"],"sql"],
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
  ["handlebars","Handlebars",["hbs","handlebars","mustache"],"markup"],
  ["pug","Pug",["pug"],"markup"],
  ["stylus","Stylus",["styl"],"style"],
  ["tailwind","PostCSS",["pcss","postcss"],"style"],
  ["capnp","Cap'n Proto",["capnp"],"c"],
  ["fortran","Fortran",["f","for","f90","f95","f03","f08"],"c"],
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
  ["verilog","Verilog",["v","vh","sv","svh"],"c"],
  ["vhdl","VHDL",["vhd","vhdl"],"c"],
  ["matlab","MATLAB",["m"],"script"],
  ["octave","GNU Octave",["oct"],"script"],
  ["opencl","OpenCL",["cl"],"c"],
  ["cuda","CUDA",["cu","cuh"],"c"],
  ["glsl","GLSL",["glsl","vert","frag","geom","tesc","tese"],"c"],
  ["hlsl","HLSL",["hlsl","fx"],"c"],
  ["godot","GDScript",["gd"],"script"],
  ["gdshader","Godot Shader",["gdshader"],"c"],
  ["renpy","Ren'Py",["rpy"],"script"],
  ["gml","GameMaker Language",["gml"],"c"],
  ["gdextension","GDExtension",["gdextension"],"data"],
  ["svelteconfig","Svelte Config",["svelte.config.js"],"script"],
  ["astroconfig","Astro Config",["astro.config.mjs"],"script"],
  ["prisma","Prisma",["prisma"],"c"],
  ["graphqlconfig","GraphQL Config",["graphqlrc"],"data"],
  ["vueconfig","Vue Config",["vue.config.js"],"script"],
  ["protobuf","Protocol Buffers Text",["textproto","pbtxt"],"data"],
  ["futhark","Futhark",["fut"],"c"],
  ["gleam","Gleam",["gleam"],"script"],
  ["roc","Roc",["roc"],"script"],
  ["solidity-yul","Yul",["yul"],"c"],
  ["qsharp","Q#",["qs"],"c"],
  ["pkl","Pkl",["pkl"],"data"],
  ["cue","CUE",["cue"],"data"],
  ["jsonnet","Jsonnet",["jsonnet","libsonnet"],"script"],
  ["rego","Rego",["rego"],"script"],
  ["bicep","Bicep",["bicep"],"script"],
  ["blade","Blade",["blade.php"],"markup"],
  ["erb","ERB",["erb"],"markup"],
  ["ejs","EJS",["ejs"],"markup"],
  ["haml","Haml",["haml"],"markup"],
  ["liquid","Liquid",["liquid"],"markup"],
  ["graphql","GraphQL Schema",["graphqls"],"c"],
  ["cmake","CMake Cache",["cmakecache"],"data"],
  ["gitignore","Git Ignore",["gitignore"],"data",[".gitignore",".dockerignore",".npmignore",".prettierignore"]],
  ["gitconfig","Git Config",["gitconfig"],"data",[".gitconfig"]],
  ["env","Environment",["env"],"data",[".env",".env.example",".env.local"]],
  ["lock","Lockfile",["lock"],"data",["package-lock.json","pnpm-lock.yaml","yarn.lock","Cargo.lock","Gemfile.lock"]],
  ["gradle","Gradle",["gradle.kts"],"c",["settings.gradle","build.gradle","settings.gradle.kts","build.gradle.kts"]],
  ["bazel","Bazel",["bzl"],"script",["BUILD","BUILD.bazel","WORKSPACE","WORKSPACE.bazel"]],
  ["just","Just",["just"],"script",["Justfile"]],
  ["taskfile","Taskfile",["taskfile.yml"],"data",["Taskfile.yml","Taskfile.yaml"]]
];

const KEYWORDS = {
  script: "if else elif then fi for while do done break continue return yield function async await class extends import from as export default const let var new try catch finally throw raise with in of is not and or match case switch when fn def fun val pub use mod impl trait struct enum type interface package namespace static public private protected void int float double bool string true false null nil self this super print echo pass lambda",
  c: "if else for while do break continue return switch case default try catch finally throw class struct enum union typedef namespace using public private protected static const let var fn func function void int long short char float double bool string true false null nullptr self this new delete import include define package async await",
  sql: "select from where and or not null is as join inner left right full outer on group by order having limit offset insert into values update set delete create alter drop table database index view primary key foreign references unique check constraint default count sum avg min max distinct union all case when then else end like between in exists",
  lisp: "define lambda let let* if cond begin quote set! define-syntax require provide module import defn defmacro fn loop recur",
  markup: "html head body title meta link script style div span p a img section article header footer main nav button input form label ul ol li table tr td th h1 h2 h3 h4 h5 h6 svg path rect circle"
};

const FILENAME_RULES = Object.freeze([
  [".d.ts","typescript"],["dockerfile","dockerfile"],["containerfile","dockerfile"],
  ["makefile","makefile"],["gnumakefile","makefile"],["cmakelists.txt","cmake"],
  ["nginx.conf","nginx"],[".gitignore","gitignore"],[".dockerignore","gitignore"],
  [".npmignore","gitignore"],[".prettierignore","gitignore"],[".gitconfig","gitconfig"],
  [".env","env"],[".env.example","env"],[".env.local","env"],
  ["package-lock.json","lock"],["pnpm-lock.yaml","lock"],["yarn.lock","lock"],
  ["cargo.lock","lock"],["gemfile.lock","lock"],["settings.gradle","gradle"],
  ["build.gradle","gradle"],["settings.gradle.kts","gradle"],["build.gradle.kts","gradle"],
  ["build.bazel","bazel"],["workspace.bazel","bazel"],["build","bazel"],
  ["workspace","bazel"],["justfile","just"],["taskfile.yml","taskfile"],["taskfile.yaml","taskfile"]
]);

function toEntry(definition) {
  const [id,name,extensions,category,fileNames=[]] = definition;
  return { id, name, extensions:[...extensions], category, keywords:KEYWORDS[category] || "", fileNames:[...fileNames] };
}
function listLanguages() {
  const grouped = new Map();
  for (const definition of DEFINITIONS) {
    const entry = toEntry(definition);
    if (!grouped.has(entry.id)) grouped.set(entry.id, entry);
    else {
      const existing = grouped.get(entry.id);
      for (const ext of entry.extensions) if (!existing.extensions.includes(ext)) existing.extensions.push(ext);
      for (const name of entry.fileNames) if (!existing.fileNames.includes(name)) existing.fileNames.push(name);
    }
  }
  return [...grouped.values()];
}
function getLanguageByFileName(fileName) {
  const base = String(fileName || "").replace(/\\/g,"/").split("/").pop().toLowerCase();
  for (const [pattern,id] of FILENAME_RULES) {
    if (base === pattern || (pattern.startsWith(".") && base.endsWith(pattern))) {
      return listLanguages().find(language => language.id === id) || null;
    }
  }
  const extension = base.includes(".") ? base.split(".").pop() : base;
  return getLanguageByExtension(extension);
}
function getLanguageByExtension(extension) {
  const ext = String(extension || "").replace(/^\./,"").toLowerCase();
  // Los alias ambiguos tienen una prioridad explícita y estable.
  const priority = { sv:"verilog",svh:"verilog",v:"verilog",m:"matlab",mm:"objectivec",pl:"perl",h:"c",f:"fortran" };
  if (priority[ext]) {
    const chosen = listLanguages().find(language => language.id === priority[ext]);
    if (chosen && chosen.extensions.includes(ext)) return chosen;
  }
  return listLanguages().find(language => language.extensions.includes(ext)) || {
    id:"plaintext",name:"Texto plano",extensions:[],category:"plain",keywords:"",fileNames:[]
  };
}
function getSupportedExtensions() {
  return [...new Set(DEFINITIONS.flatMap(([, , extensions]) => extensions))].sort();
}
module.exports = { getLanguageByExtension, getLanguageByFileName, listLanguages, getSupportedExtensions };
