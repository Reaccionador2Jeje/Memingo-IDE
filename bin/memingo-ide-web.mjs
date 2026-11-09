#!/usr/bin/env node
import { main } from "../scripts/web-server.mjs";

main().catch(error => {
  console.error("Memingo IDE Web:", error.message);
  process.exitCode = 1;
});
