import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

test("versão e scripts do MVP", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.version, "0.1.0");
  assert.ok(pkg.scripts.build.includes("vite build"));
  assert.ok(pkg.scripts.typecheck.includes("tsc"));
});

test("arquivos críticos", () => {
  for (const file of ["src/App.tsx", "src/lib/github.ts", "src/lib/storage.ts", "supabase/migrations/20261028000000_repository_workspaces.sql"]) {
    assert.equal(existsSync(new URL("../" + file, import.meta.url)), true, file);
  }
});

test("nunca deixar credenciais no .env.example", () => {
  const env = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  assert.ok(!/GITHUB_TOKEN|service_role|PRIVATE_KEY/i.test(env));
});
