import test from "node:test";
import assert from "node:assert/strict";
import { configureManifest } from "../scripts/configure-android-oauth.mjs";

const manifest = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application>
        <activity android:name=".MainActivity" android:exported="true">
        </activity>
    </application>
</manifest>`;

test("registers the exact Memingo OAuth callback", () => {
  const result = configureManifest(manifest);
  assert.match(result, /android:scheme="dev\.atdev\.memingoide"/);
  assert.match(result, /android:host="oauth"/);
  assert.match(result, /android:path="\/callback"/);
  assert.match(result, /android\.intent\.action\.VIEW/);
});

test("is idempotent", () => {
  const once = configureManifest(manifest);
  assert.equal(configureManifest(once), once);
});

test("fails when MainActivity is missing", () => {
  assert.throws(() => configureManifest("<manifest><application /></manifest>"), /MainActivity/);
});
