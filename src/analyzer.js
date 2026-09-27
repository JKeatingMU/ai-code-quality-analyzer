/**
 * AI Code Quality Analyzer - Core Analysis Engine
 * 
 * This module implements both traditional complexity metrics and a novel
 * AI-Code Quality Index (ACQI) specifically designed for evaluating
 * machine-generated code.
 *
 * Metrics version 2 (2026-09-26). Changes from version 1 (kept verbatim in
 * analyzer-v1.js, selected with `acqa analyze --legacy`, to reproduce
 * published results):
 * - JSX files are parsed in JSX mode (v1 passed ecmaFeatures.jsx, which
 *   typescript-estree ignores, so every JSX file failed to parse and Pure
 *   Function Ratio, Decomposability and Cognitive Complexity fell back to
 *   defaults).
 * - Decomposability requests node ranges (v1 never did, so it returned 0.5
 *   for any file containing a function).
 * - Type Explicitness walks the AST: typed declaration slots / all slots.
 *   A file with no slots returns null (not applicable) instead of 1.0, and
 *   ACQI is then the weighted mean of the remaining sub-metrics.
 */

import { parse } from '@typescript-eslint/typescript-estree';
import fs from 'fs/promises';
import path from 'path';

export const METRICS_VERSION = 2.1;

let parseJSX = true;

function parseCode(code, extra = {}) {
  return parse(code, { ecmaVersion: 'latest', sourceType: 'module', jsx: parseJSX, ...extra });
}

/**
 * Calculate McCabe Cyclomatic Complexity
 * Based on keyword counting heuristic from the uploaded document
 */
export function calculateMcCabeComplexity(code) {
  let complexity = 1; // Base complexity
  
  const patterns = [
    /\bif\b/g,
    /\belse\b/g,
    /\bwhile\b/g,
    /\bfor\b/g,
    /\bcatch\b/g,
    /\bcase\b/g,
    /\?/g,  // Ternary
    /&&/g,  // Logical AND
    /\|\|/g // Logical OR
  ];
  
  patterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) complexity += matches.length;
  });
  
  return complexity;
}

/**
 * Calculate Cognitive Complexity with nesting depth penalty
 * Based on SonarSource methodology (Campbell, 2017)
 */
export function calculateCognitiveComplexity(code) {
  try {
    const ast = parseCode(code);
    
    let complexity = 0;
    let nestingLevel = 0;
    
    function traverse(node) {
      if (!node || typeof node !== 'object') return;
      
      // Control flow structures that increment complexity
      const incrementingNodes = [
        'IfStatement',
        'ForStatement', 
        'WhileStatement',
        'DoWhileStatement',
        'CatchClause',
        'SwitchStatement',
        'ConditionalExpression'
      ];
      
      if (incrementingNodes.includes(node.type)) {
        complexity += 1 + nestingLevel; // Base + nesting penalty
        nestingLevel++;
      }
      
      // Process children
      for (const key in node) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else if (child && typeof child === 'object') {
          traverse(child);
        }
      }
      
      // Decrease nesting after processing
      if (incrementingNodes.includes(node.type)) {
        nestingLevel--;
      }
    }
    
    traverse(ast);
    return complexity;
    
  } catch (error) {
    // Fallback to simple heuristic if parsing fails
    return calculateMcCabeComplexity(code);
  }
}

/**
 * NOVEL METRIC 1: Type Explicitness Score
 * Share of declaration slots that carry an explicit type. Slots: each function
 * parameter, the return type of each block-bodied function, each variable that
 * is neither destructured nor initialised with a function, and each interface
 * property. Returns null when a file has no slots (not applicable).
 */
export function calculateTypeExplicitness(code) {
  let ast;
  try {
    ast = parseCode(code);
  } catch (error) {
    return null;
  }

  let typed = 0;
  let untyped = 0;
  const isFunction = n => n && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);

  function paramTyped(p) {
    if (!p) return false;
    if (p.typeAnnotation) return true;
    if (p.type === 'AssignmentPattern') return paramTyped(p.left);
    if (p.type === 'RestElement') return paramTyped(p.argument);
    if (p.type === 'TSParameterProperty') return paramTyped(p.parameter);
    return false;
  }

  function traverse(node) {
    if (!node || typeof node !== 'object') return;

    if (isFunction(node)) {
      for (const p of node.params || []) paramTyped(p) ? typed++ : untyped++;
      if (node.returnType) typed++;
      else if (node.body && node.body.type === 'BlockStatement') untyped++;
    }

    if (node.type === 'VariableDeclarator') {
      if (node.id && node.id.typeAnnotation) typed++;
      else if (node.id && node.id.type === 'Identifier' && node.init && !isFunction(node.init)) untyped++;
    }

    if (node.type === 'TSPropertySignature' && node.typeAnnotation) typed++;

    for (const key in node) {
      if (key === 'parent') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(traverse);
      else if (child && typeof child === 'object') traverse(child);
    }
  }

  traverse(ast);
  const total = typed + untyped;
  return total === 0 ? null : typed / total;
}

/**
 * Version 1 Type Explicitness (regular-expression heuristic), kept for
 * comparison exercises. Not used in ACQI from version 2.
 */
export function calculateTypeExplicitnessRegex(code) {
  const anyCount = (code.match(/:\s*any\b/g) || []).length;
  const implicitCount = (code.match(/=\s*\(/g) || []).length;
  const explicitCount = (code.match(/:\s*[A-Z][a-zA-Z<>[\],\s]*/g) || []).length;
  if (explicitCount + anyCount + implicitCount === 0) return 1.0;
  return explicitCount / (explicitCount + anyCount + implicitCount);
}

/**
 * NOVEL METRIC 2: Pure Function Ratio (metrics v2.1)
 * Share of functions whose own body has no side effect. Nested functions are
 * judged separately, so an event handler defined inside a component does not
 * make the component impure. A function is impure if its body:
 * - assigns to, or updates, anything it did not declare itself (including
 *   properties of parameters, outer variables and `this`);
 * - calls a known side-effecting API (console, fetch, timers, storage,
 *   document/window/navigator/location/history, Math.random, Date.now,
 *   argument-less `new Date()`), or reads a browser global;
 * - calls a state setter (`setX`) or `dispatch`, or calls a function it
 *   received as a parameter, its own or an enclosing function's (a callback
 *   such as `onAdd`, including one captured by a nested handler);
 * - calls a mutating method (push, sort, preventDefault, ...) on something it
 *   did not declare itself.
 * React hooks (`useX`) are not side effects, following React's own model.
 */
const FUNCTION_TYPES = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'];
const EFFECT_GLOBALS = new Set(['console', 'document', 'window', 'navigator', 'location', 'history',
  'localStorage', 'sessionStorage', 'indexedDB', 'globalThis', 'process']);
const EFFECT_FUNCTIONS = new Set(['fetch', 'alert', 'confirm', 'prompt', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
  'dispatch', 'postMessage']);
const MUTATING_METHODS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill',
  'copyWithin', 'set', 'add', 'delete', 'clear', 'preventDefault', 'stopPropagation',
  'stopImmediatePropagation', 'focus', 'blur', 'click', 'submit', 'reset', 'scrollTo', 'scrollIntoView',
  'play', 'pause', 'appendChild', 'removeChild', 'setAttribute', 'removeAttribute', 'addEventListener',
  'removeEventListener', 'assign', 'defineProperty', 'next', 'then', 'catch', 'finally']);

function patternNames(node, out = new Set()) {
  if (!node) return out;
  switch (node.type) {
    case 'Identifier': out.add(node.name); break;
    case 'ObjectPattern': node.properties.forEach(p => patternNames(p.type === 'RestElement' ? p.argument : p.value, out)); break;
    case 'ArrayPattern': node.elements.forEach(e => patternNames(e, out)); break;
    case 'AssignmentPattern': patternNames(node.left, out); break;
    case 'RestElement': patternNames(node.argument, out); break;
    case 'TSParameterProperty': patternNames(node.parameter, out); break;
  }
  return out;
}

function rootIdentifier(node) {
  while (node && (node.type === 'MemberExpression' || node.type === 'TSNonNullExpression' || node.type === 'ChainExpression')) {
    node = node.type === 'MemberExpression' ? node.object : node.expression;
  }
  return node;
}

function eachOwnNode(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const key in node) {
    if (key === 'parent') continue;
    const child = node[key];
    const list = Array.isArray(child) ? child : [child];
    for (const c of list) {
      if (c && typeof c === 'object' && c.type && !FUNCTION_TYPES.includes(c.type)) eachOwnNode(c, visit);
    }
  }
}

export function isPureFunction(fn, enclosingParams = new Set()) {
  const params = new Set(enclosingParams);
  fn.params.forEach(p => patternNames(p, params));
  const locals = new Set();
  eachOwnNode(fn.body, n => {
    if (n.type === 'VariableDeclarator') patternNames(n.id, locals);
    if (n.type === 'FunctionDeclaration' && n.id) locals.add(n.id.name);
  });
  const own = name => locals.has(name);
  let pure = true;

  eachOwnNode(fn.body, n => {
    if (!pure) return;
    if (n.type === 'AssignmentExpression' || n.type === 'UpdateExpression') {
      const target = n.type === 'AssignmentExpression' ? n.left : n.argument;
      const root = rootIdentifier(target);
      if (!root || root.type !== 'Identifier' || !own(root.name)) pure = false;
      return;
    }
    if (n.type === 'ThisExpression') { pure = false; return; }
    if (n.type === 'NewExpression' && n.callee.type === 'Identifier' && n.callee.name === 'Date' && n.arguments.length === 0) { pure = false; return; }
    if (n.type === 'Identifier' && EFFECT_GLOBALS.has(n.name) && !own(n.name) && !params.has(n.name)) { pure = false; return; }
    if (n.type === 'CallExpression') {
      const callee = n.callee.type === 'ChainExpression' ? n.callee.expression : n.callee;
      if (callee.type === 'Identifier') {
        const name = callee.name;
        if (/^use[A-Z0-9]/.test(name)) return;
        if (EFFECT_FUNCTIONS.has(name) || /^set[A-Z]/.test(name) || params.has(name)) pure = false;
        return;
      }
      if (callee.type === 'MemberExpression') {
        const root = rootIdentifier(callee);
        const method = callee.property && (callee.property.name || callee.property.value);
        if (root && root.type === 'Identifier') {
          if (root.name === 'Math' && method === 'random') { pure = false; return; }
          if (root.name === 'Date' && method === 'now') { pure = false; return; }
          if (params.has(root.name) && callee.object === root && /^on[A-Z]/.test(method || '')) { pure = false; return; }
          if (MUTATING_METHODS.has(method) && !own(root.name)) { pure = false; return; }
        } else if (MUTATING_METHODS.has(method)) {
          pure = false;
        }
      }
    }
  });
  return pure;
}

export function calculatePureFunctionRatio(code) {
  try {
    const ast = parseCode(code);
    let total = 0;
    let pure = 0;
    (function walk(node, enclosing) {
      if (!node || typeof node !== 'object') return;
      let inner = enclosing;
      if (FUNCTION_TYPES.includes(node.type)) {
        total++;
        if (isPureFunction(node, enclosing)) pure++;
        inner = new Set(enclosing);
        node.params.forEach(p => patternNames(p, inner));
      }
      for (const key in node) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) child.forEach(c => walk(c, inner));
        else if (child && typeof child === 'object') walk(child, inner);
      }
    })(ast, new Set());
    return total === 0 ? null : pure / total;
  } catch (error) {
    return null;
  }
}

/**
 * NOVEL METRIC 3: Decomposability Score (metrics v2.1)
 * Function-length risk thresholds are derived from benchmark data, not chosen:
 * LOC-weighted, repository-normalised 70th/80th/90th percentiles of function
 * length in a pre-Copilot benchmark of permissively licensed React/TypeScript
 * repositories (method of Alves, Ypma and Visser, 2010). See
 * DECOMPOSABILITY_THRESHOLDS for the values and their provenance.
 * Each function scores 1 (low risk), 2/3 (moderate), 1/3 (high) or 0 (very
 * high); the file score is the line-weighted mean. Null when a file has no
 * functions.
 */
export const DECOMPOSABILITY_THRESHOLDS = {
  moderate: 56,
  high: 81,
  veryHigh: 134,
  provenance: 'LOC-weighted, repository-normalised p70/p80/p90 of function length; 224 pre-Copilot React/TypeScript repositories (MIT/Apache-2.0, state at last commit before 2022-06-01), 56,276 functions; derived 2026-09-27 (ACQA benchmark-pre-copilot)',
};

export function decompositionScore(lines, t = DECOMPOSABILITY_THRESHOLDS) {
  if (lines <= t.moderate) return 1;
  if (lines <= t.high) return 2 / 3;
  if (lines <= t.veryHigh) return 1 / 3;
  return 0;
}

export function calculateDecomposability(code) {
  try {
    const ast = parseCode(code, { range: true });
    let weighted = 0;
    let lines = 0;
    (function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (FUNCTION_TYPES.includes(node.type) && node.body) {
        const L = code.slice(node.range[0], node.range[1]).split('\n').length;
        weighted += L * decompositionScore(L);
        lines += L;
      }
      for (const key in node) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) child.forEach(walk);
        else if (child && typeof child === 'object') walk(child);
      }
    })(ast);
    return lines === 0 ? null : weighted / lines;
  } catch (error) {
    return null;
  }
}

/**
 * NOVEL METRIC 4: Pattern Consistency Score
 * Measures consistency in code patterns (naming, structure, etc.)
 * AI code tends to be more consistent than human code
 */
export function calculatePatternConsistency(code) {
  // Analyze naming patterns
  const camelCaseVars = (code.match(/\b[a-z][a-zA-Z0-9]*\b/g) || []).length;
  const PascalCaseVars = (code.match(/\b[A-Z][a-zA-Z0-9]*\b/g) || []).length;
  const snake_case_vars = (code.match(/\b[a-z]+_[a-z_]+\b/g) || []).length;
  
  const total = camelCaseVars + PascalCaseVars + snake_case_vars;
  if (total === 0) return 1.0;
  
  // Calculate entropy - lower entropy = more consistent
  const patterns = [camelCaseVars, PascalCaseVars, snake_case_vars];
  const maxPattern = Math.max(...patterns);
  
  return maxPattern / total; // Dominant pattern percentage
}

/**
 * NOVEL METRIC 5: Structural Predictability
 * Measures how "template-like" the code structure is
 * AI code often follows predictable patterns
 */
export function calculateStructuralPredictability(code) {
  // Look for common React/Vite patterns
  const patterns = {
    hasImports: /^import\s+/m.test(code),
    hasExport: /export\s+(default|const|function)/m.test(code),
    usesHooks: /use[A-Z][a-zA-Z]*\(/g.test(code),
    hasJSX: /<[A-Z][a-zA-Z]*/.test(code),
    hasTypeAnnotations: /:\s*[A-Z][a-zA-Z<>[\]]*/.test(code),
    consistentStructure: /^(import[\s\S]*?)(const|function)[\s\S]*export/m.test(code)
  };
  
  const matchedPatterns = Object.values(patterns).filter(Boolean).length;
  return matchedPatterns / Object.keys(patterns).length;
}

/**
 * NOVEL COMPOSITE METRIC: AI-Code Quality Index (ACQI)
 * 
 * A weighted combination of metrics specifically designed to evaluate
 * AI-generated code quality based on properties that matter for
 * machine-maintainable code.
 * 
 * Formula:
 * ACQI = (0.25 * TypeExplicitness) + 
 *        (0.30 * PureFunctionRatio) + 
 *        (0.20 * Decomposability) +
 *        (0.15 * PatternConsistency) +
 *        (0.10 * StructuralPredictability)
 * 
 * Returns: 0.0 to 1.0 (higher is better)
 */
export function calculateACQI(metrics) {
  const weights = {
    typeExplicitness: 0.25,
    pureFunctionRatio: 0.30,
    decomposability: 0.20,
    patternConsistency: 0.15,
    structuralPredictability: 0.10
  };
  let sum = 0;
  let weight = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (metrics[k] == null) continue;
    sum += w * metrics[k];
    weight += w;
  }
  return weight === 0 ? null : sum / weight;
}

/**
 * Analyze a single file and return all metrics
 */
export async function analyzeFile(filePath) {
  const code = await fs.readFile(filePath, 'utf-8');
  parseJSX = !/\.(ts|mts|cts)$/.test(filePath);
  const lines = code.split('\n').length;
  const size = code.length;
  
  // Traditional metrics
  const mccabe = calculateMcCabeComplexity(code);
  const cognitive = calculateCognitiveComplexity(code);
  
  // Novel AI-specific metrics
  const typeExplicitness = calculateTypeExplicitness(code);
  const pureFunctionRatio = calculatePureFunctionRatio(code);
  const decomposability = calculateDecomposability(code);
  const patternConsistency = calculatePatternConsistency(code);
  const structuralPredictability = calculateStructuralPredictability(code);
  
  const metrics = {
    typeExplicitness,
    pureFunctionRatio,
    decomposability,
    patternConsistency,
    structuralPredictability
  };
  
  const acqi = calculateACQI(metrics);
  
  return {
    file: path.basename(filePath),
    path: filePath,
    lines,
    size,
    // Traditional metrics
    mccabeComplexity: mccabe,
    cognitiveComplexity: cognitive,
    // Novel AI-specific metrics
    typeExplicitness: typeExplicitness == null ? null : Number(typeExplicitness.toFixed(3)),
    pureFunctionRatio: pureFunctionRatio == null ? null : Number(pureFunctionRatio.toFixed(3)),
    decomposability: decomposability == null ? null : Number(decomposability.toFixed(3)),
    patternConsistency: Number(patternConsistency.toFixed(3)),
    structuralPredictability: Number(structuralPredictability.toFixed(3)),
    // Composite AI metric
    acqi: acqi == null ? null : Number(acqi.toFixed(3))
  };
}

export default {
  analyzeFile,
  calculateMcCabeComplexity,
  calculateCognitiveComplexity,
  calculateACQI
};
