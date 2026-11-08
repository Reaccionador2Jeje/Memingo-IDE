"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getProtocolAdapter,
  listProtocolAdapters,
  supportsAdapterOperation,
  assertAdapterOperation
} = require("../src/agents/adapter-contract");

test("los adaptadores HTTP y ACP declaran el contrato completo", () => {
  const adapters = listProtocolAdapters();
  assert.deepEqual(adapters.map(adapter => adapter.id).sort(), ["acp", "http"]);
  for (const adapter of adapters) {
    assert.deepEqual(adapter.operations, ["connect", "send", "permission", "stop", "disconnect"]);
    assert.ok(adapter.label);
    assert.ok(adapter.description);
  }
});

test("los protocolos desconocidos no se resuelven", () => {
  assert.equal(getProtocolAdapter("shell"), null);
  assert.equal(getProtocolAdapter("__proto__"), null);
  assert.equal(getProtocolAdapter("constructor"), null);
});

test("el contrato reconoce operaciones válidas", () => {
  for (const protocol of ["http", "acp"]) {
    for (const operation of ["connect", "send", "permission", "stop", "disconnect"]) {
      assert.equal(supportsAdapterOperation(protocol, operation), true);
      assert.equal(assertAdapterOperation(protocol, operation).id, protocol);
    }
  }
});

test("se rechazan operaciones o protocolos no declarados", () => {
  assert.equal(supportsAdapterOperation("http", "execute-shell"), false);
  assert.equal(supportsAdapterOperation("unknown", "connect"), false);
  assert.throws(() => assertAdapterOperation("http", "execute-shell"), /no admite la operación/);
  assert.throws(() => assertAdapterOperation("unknown", "connect"), /no admite la operación/);
});
