"use strict";

// Registro central de motores permitidos. Nunca se aceptan comandos desde la interfaz.
const AGENT_ENGINES = Object.freeze({
  opencode: Object.freeze({
    id: "opencode",
    name: "OpenCode",
    license: "MIT",
    protocol: "http",
    description: "Servidor local de agentes con API HTTP.",
    docs: "https://opencode.ai/docs/",
    installHint: "Instala el comando opencode y configura un proveedor."
  }),
  goose: Object.freeze({
    id: "goose",
    name: "Goose",
    license: "Apache-2.0",
    protocol: "acp",
    description: "Agente local compatible con Agent Client Protocol.",
    docs: "https://goose-docs.ai/docs/quickstart/",
    installHint: "Instala el comando goose y configura un proveedor."
  })
});

const AGENT_PROFILES = Object.freeze({
  plan: Object.freeze({
    id: "plan",
    label: "Planificador",
    description: "Analiza la idea y prepara pasos sin editar archivos.",
    instruction: "Trabaja en modo planificación. No edites archivos ni ejecutes comandos. Explica cada paso en español sencillo.",
    openCodeInstruction: "Analiza el proyecto y explica en español un plan paso a paso. No modifiques archivos ni ejecutes comandos."
  }),
  build: Object.freeze({
    id: "build",
    label: "Constructor",
    description: "Construye y modifica el proyecto; revisa cada permiso.",
    instruction: "Ayuda a construir lo solicitado. Antes de cada operación que requiera permiso, espera la decisión del usuario. Explica en español qué harás. No publiques ni subas cambios a Git.",
    openCodeInstruction: "Ayuda a construir lo solicitado. Antes de cada acción que requiera permiso, espera la aprobación del usuario. Explica en español qué cambiarás y por qué. No publiques ni subas cambios a Git."
  }),
  review: Object.freeze({
    id: "review",
    label: "Revisor",
    description: "Busca errores y propone mejoras sin editar.",
    instruction: "Revisa el proyecto y explica errores y mejoras en español. No edites archivos ni ejecutes comandos.",
    openCodeInstruction: "Revisa el proyecto buscando errores, riesgos y mejoras. No modifiques archivos ni ejecutes comandos. Explica los hallazgos en español y ordénalos por importancia."
  })
});

function getAgentEngine(id) {
  return Object.prototype.hasOwnProperty.call(AGENT_ENGINES, id) ? AGENT_ENGINES[id] : null;
}
function listAgentEngines() {
  return Object.values(AGENT_ENGINES).map(({ id, name, license, protocol, description, docs, installHint }) => ({
    id, name, license, protocol, description, docs, installHint
  }));
}
function getAgentProfile(id) {
  return Object.prototype.hasOwnProperty.call(AGENT_PROFILES, id) ? AGENT_PROFILES[id] : null;
}
function listAgentProfiles() {
  return Object.values(AGENT_PROFILES).map(({ id, label, description }) => ({ id, label, description }));
}

module.exports = { getAgentEngine, listAgentEngines, getAgentProfile, listAgentProfiles };
