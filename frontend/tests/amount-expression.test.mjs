import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAmountExpression,
  isAmountExpression,
  normalizeAmountText,
} from "../src/utils/amountExpression.js";

test("amount expressions evaluate to their sum", () => {
  assert.equal(evaluateAmountExpression("230+320"), 550);
  assert.equal(evaluateAmountExpression("100+200+300"), 600);
  assert.equal(evaluateAmountExpression("0+0"), 0);
  assert.equal(evaluateAmountExpression("12.5+7.5"), 20);
});

test("amount expressions accept Persian/Arabic digits and separators", () => {
  assert.equal(evaluateAmountExpression("۲۳۰+۳۲۰"), 550);
  assert.equal(evaluateAmountExpression("٢٣٠+٣٢٠"), 550);
  assert.equal(evaluateAmountExpression("1,200 + 300"), 1500);
  assert.equal(evaluateAmountExpression("۱٬۲۰۰+۳۰۰"), 1500);
});

test("plain numbers are not expressions", () => {
  assert.equal(isAmountExpression("230"), false);
  assert.equal(isAmountExpression("۲۳۰"), false);
  assert.equal(evaluateAmountExpression("230"), null);
  assert.equal(evaluateAmountExpression(""), null);
});

test("broken expressions evaluate to null instead of a wrong total", () => {
  assert.equal(evaluateAmountExpression("230+"), null);
  assert.equal(evaluateAmountExpression("+320"), null);
  assert.equal(evaluateAmountExpression("230++320"), null);
  assert.equal(evaluateAmountExpression("230+abc"), null);
  assert.equal(evaluateAmountExpression("+"), null);
});

test("normalizeAmountText unifies digits and strips separators", () => {
  assert.equal(normalizeAmountText("۲۳۰"), "230");
  assert.equal(normalizeAmountText("1,200"), "1200");
  assert.equal(normalizeAmountText(null), "");
});
