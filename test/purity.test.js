import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '@typescript-eslint/typescript-estree';
import { isPureFunction, calculatePureFunctionRatio } from '../src/analyzer.js';

const firstFunction = (code) => {
  const ast = parse(code, { jsx: true });
  let found = null;
  (function walk(n) {
    if (found || !n || typeof n !== 'object') return;
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type)) { found = n; return; }
    for (const k in n) { const c = n[k]; if (Array.isArray(c)) c.forEach(walk); else if (c && typeof c === 'object') walk(c); }
  })(ast);
  return found;
};
const pure = (code) => isPureFunction(firstFunction(code));

const PURE = [
  ['formats a number', 'const f = (price: number) => `€${price.toFixed(2)}`;'],
  ['calls Math.max', 'const f = (q: number) => Math.max(1, Math.floor(q));'],
  ['uses Intl', "const f = (p: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(p);"],
  ['mutates only its own local array', 'function f(xs: number[]) { const out = []; for (const x of xs) out.push(x * 2); return out; }'],
  ['sorts a local copy', 'const f = (xs: number[]) => { const c = [...xs]; c.sort(); return c; };'],
  ['component that calls hooks and defines a handler', 'const C = ({ product, onAdd }) => { const [q, setQ] = useState(1); const add = () => onAdd(product, q); return <button onClick={add}>Add</button>; };'],
  ['reads a property of a parameter', 'const f = (p) => p.price * 2;'],
];
const IMPURE = [
  ['logs', 'const f = () => console.log("hi");'],
  ['calls a state setter', 'const f = () => setCount(0);'],
  ['calls a prop callback', 'const f = ({ onAdd, product }) => { onAdd(product, 1); };'],
  ['calls a callback property of a parameter', 'const f = (props) => props.onAdd(1);'],
  ['prevents default on an event', 'const f = (e) => { e.preventDefault(); };'],
  ['assigns to an outer variable', 'let total = 0; const f = (x) => { total = x; };'],
  ['mutates a parameter', 'const f = (o) => { o.count = 1; };'],
  ['pushes onto a parameter array', 'const f = (xs) => { xs.push(1); };'],
  ['uses randomness', 'const f = () => Math.random();'],
  ['reads the clock', 'const f = () => Date.now();'],
  ['creates the current date', 'const f = () => new Date();'],
  ['reads a browser global', 'const f = () => window.location.origin;'],
  ['fetches', 'const f = () => fetch("/api");'],
  ['dispatches', 'const f = (item) => dispatch({ type: "add", item });'],
];

for (const [name, code] of PURE) test(`pure: ${name}`, () => assert.equal(pure(code), true));
for (const [name, code] of IMPURE) test(`impure: ${name}`, () => assert.equal(pure(code), false));

test('nested handler is judged separately from its component', () => {
  const code = 'const C = ({ onAdd }) => { const h = () => onAdd(1); return <button onClick={h} />; };';
  assert.equal(calculatePureFunctionRatio(code), 0.5);
});
test('a file with no functions is not applicable', () => {
  assert.equal(calculatePureFunctionRatio('export const X = 1;'), null);
});

import { decompositionScore, calculateDecomposability } from '../src/analyzer.js';
test('decomposition score steps down at the thresholds', () => {
  const t = { moderate: 10, high: 20, veryHigh: 30 };
  assert.deepEqual([5, 10, 11, 20, 21, 30, 31].map(L => decompositionScore(L, t)), [1, 1, 2 / 3, 2 / 3, 1 / 3, 1 / 3, 0]);
});
test('a file with no functions has no decomposability score', () => {
  assert.equal(calculateDecomposability('export const X = 1;'), null);
});
