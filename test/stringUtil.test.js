const assert = require("node:assert/strict");
const test = require("node:test");
const { isAlpha, betweenText } = require("../dest/stringUtil");

test("isAlpha()", (t) => {
  assert.strictEqual(isAlpha(null), false);
  assert.strictEqual(isAlpha(''), false);
  assert.strictEqual(isAlpha('-'), false);
  assert.strictEqual(isAlpha('0'), false);
  assert.strictEqual(isAlpha('%'), false);
  assert.strictEqual(isAlpha('A'), true);
  assert.strictEqual(isAlpha('z'), true);
});

test("betweenText()", (t) => {
  assert.strictEqual(betweenText(null, 0, null), null);
  assert.strictEqual(betweenText("a 12 34 z", 0, null), null);
  assert.deepEqual(betweenText("a 12 34 z", 3, "4 "), ["2 3", 6]);
  assert.deepEqual(betweenText("a 12 34 z", -1, "4 "), ["a 12 3", 6]);
  assert.deepEqual(betweenText("a 12 34 z", 2, "2 "), ["1", 3]);
  assert.deepEqual(betweenText("a 12 34 z", 5, "2 "), null);
  assert.strictEqual(betweenText("a 12 34 z", 0, "-"), null);
});