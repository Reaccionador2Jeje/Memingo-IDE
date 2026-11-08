"use strict";

// Contrato común de los adaptadores de transporte de agentes.
// Cada motor registrado debe usar un protocolo declarado aquí.
const PROTOCOL_ADAPTERS = Object.freeze({
  http: Object.freeze({
    id: "http",
    label: "HTTP local",
    description: "Comunicación con un servidor local mediante HTTP y eventos SSE.",
    operations: Object.freeze(["connect", "send", "permission", "stop", "disconnect"])
  }),
  acp: Object.freeze({
    id: "acp",
    label: "Agent Client Protocol",
    description: "Comunicación con un proceso local mediante JSON-RPC sobre ACP.",
    operations: Object.freeze(["connect", "send", "permission", "stop", "disconnect"])
  })
});

function getProtocolAdapter(protocol) {
  return Object.prototype.hasOwnProperty.call(PROTOCOL_ADAPTERS, protocol)
    ? PROTOCOL_ADAPTERS[protocol]
    : null;
}

function listProtocolAdapters() {
  return Object.values(PROTOCOL_ADAPTERS).map(adapter => ({
    id: adapter.id,
    label: adapter.label,
    description: adapter.description,
    operations: [...adapter.operations]
  }));
}

function supportsAdapterOperation(protocol, operation) {
  const adapter = getProtocolAdapter(protocol);
  return Boolean(adapter && adapter.operations.includes(operation));
}

function assertAdapterOperation(protocol, operation) {
  if (!supportsAdapterOperation(protocol, operation)) {
    throw new Error("El adaptador '" + String(protocol) + "' no admite la operación '" + String(operation) + "'.");
  }
  return getProtocolAdapter(protocol);
}

module.exports = {
  getProtocolAdapter,
  listProtocolAdapters,
  supportsAdapterOperation,
  assertAdapterOperation
};
