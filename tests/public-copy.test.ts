import assert from "node:assert/strict";
import test from "node:test";
import { publicUiText } from "../lib/public-copy";

test("public UI copy removes market provider disclosure without damaging the message", () => {
  assert.equal(
    publicUiText("Connect the intentionally simple canvas to trusted Longbridge market data"),
    "Connect the intentionally simple canvas to trusted market data",
  );
  assert.equal(publicUiText("Longbridge feed · policy · tests · build verified"), "market feed · policy · tests · build verified");
  assert.equal(publicUiText("Trusted LONG BRIDGE opening release activated"), "Trusted opening release activated");
});
