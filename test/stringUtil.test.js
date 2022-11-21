const assert = require("node:assert/strict");
const test = require("node:test");
const { isAlpha } = require("../dest/stringUtil");

test("isAlpha()", (t) => {
  assert.throws(() => isAlpha(null));
  assert.strictEqual(isAlpha(''), false);
  assert.strictEqual(isAlpha('-'), false);
  assert.strictEqual(isAlpha('0'), false);
  assert.strictEqual(isAlpha('%'), false);
  assert.strictEqual(isAlpha('A'), true);
  assert.strictEqual(isAlpha('z'), true);
})