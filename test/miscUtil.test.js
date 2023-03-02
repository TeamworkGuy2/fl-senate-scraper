const assert = require("node:assert/strict");
const test = require("node:test");
const { arrayToChunks } = require("../dest/miscUtil");

test("arrayToChunks()", (t) => {
  assert.throws(() => arrayToChunks(null));
  assert.throws(() => arrayToChunks([]));
  assert.deepEqual(arrayToChunks([2, 2, 3, 5], 1), [[2], [2], [3], [5]]);
  assert.deepEqual(arrayToChunks([2, 2, 3, 5], 2), [[2, 2], [3, 5]]);
  assert.deepEqual(arrayToChunks([2, 2, 3, 5, 7], 2), [[2, 2], [3, 5], [7]]);
  assert.deepEqual(arrayToChunks([1, 2, 3], 5), [[1, 2, 3]]);
});
