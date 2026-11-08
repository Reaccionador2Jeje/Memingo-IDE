"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getAgentEngine,
  listAgentEngines,
  getAgentProfile,
  listAgentProfiles
} = require("../src/agents/registry");

test("el registro expone motores conocidos con protocolos admitidos", () => {
  const engines = listAgentEngines();
  assert.deepEqual(engines.map(engine => engine.id).sort(), ["goose", "opencode"]);
  assert.ok(engines.every(engine => ["http", "acp"].includes(engine.protocol)));
  assert.ok(engines.every(engine => engine.name && engine.license && engine.docs));
});

test("los IDs desconocidos no se convierten en comandos ejecutables", () => {
  assert.equal(getAgentEngine("comando-arbitrario"), null);
  assert.equal(getAgentEngine("__proto__"), null);
  assert.equal(getAgentEngine("constructor"), null);
});

test("los perfiles están centralizados y tienen instrucciones", () => {
  const profiles = listAgentProfiles();
  assert.deepEqual(profiles.map(profile => profile.id).sort(), ["build", "plan", "review"]);
  for (const id of ["plan", "build", "review"]) {
    const profile = getAgentProfile(id);
    assert.ok(profile.instruction.length > 20);
    assert.ok(profile.openCodeInstruction.length > 20);
  }
});

test("los perfiles desconocidos se rechazan", () => {
  assert.equal(getAgentProfile("root"), null);
  assert.equal(getAgentProfile(""), null);
});
