/**
 * AI Code Quality Analyzer - Core Analysis Engine
 * 
 * This module implements both traditional complexity metrics and a novel
 * AI-Code Quality Index (ACQI) specifically designed for evaluating
 * machine-generated code.
 */

import { parse } from '@typescript-eslint/typescript-estree';
import fs from 'fs/promises';
import path from 'path';

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
    const ast = parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
      comment: false,
      loc: false
    });
    
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
 * Measures ratio of explicit types vs 'any' or implicit types
 * Higher score = better for AI-generated code (indicates type discipline)
 */
export function calculateTypeExplicitness(code) {
  const anyCount = (code.match(/:\s*any\b/g) || []).length;
  const implicitCount = (code.match(/=\s*\(/g) || []).length; // Approximate implicit returns
  const explicitCount = (code.match(/:\s*[A-Z][a-zA-Z<>[\],\s]*/g) || []).length;
  
  if (explicitCount + anyCount + implicitCount === 0) return 1.0;
  
  return explicitCount / (explicitCount + anyCount + implicitCount);
}

/**
 * NOVEL METRIC 2: Pure Function Ratio
 * Detects functions with no side effects (no external mutations, I/O, etc.)
 * Higher ratio = better testability and predictability
 */
export function calculatePureFunctionRatio(code) {
  try {
    const ast = parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true }
    });
    
    let totalFunctions = 0;
    let pureFunctions = 0;
    
    function hasSideEffects(node) {
      const sideEffectPatterns = [
        'CallExpression',      // Could be console.log, fetch, etc.
        'AssignmentExpression', // Mutations
        'UpdateExpression'      // ++ or --
      ];
      
      let foundSideEffect = false;
      
      function checkNode(n) {
        if (!n || typeof n !== 'object') return;
        
        // Check for DOM access, console, fetch, etc.
        if (n.type === 'CallExpression') {
          const calleeName = n.callee?.name || n.callee?.property?.name || '';
          if (['console', 'fetch', 'localStorage', 'sessionStorage', 'setTimeout', 'setInterval'].includes(calleeName)) {
            foundSideEffect = true;
            return;
          }
        }
        
        if (sideEffectPatterns.includes(n.type)) {
          foundSideEffect = true;
          return;
        }
        
        for (const key in n) {
          if (key === 'parent') continue;
          const child = n[key];
          if (Array.isArray(child)) {
            child.forEach(checkNode);
          } else if (child && typeof child === 'object') {
            checkNode(child);
          }
        }
      }
      
      checkNode(node);
      return foundSideEffect;
    }
    
    function traverse(node) {
      if (!node || typeof node !== 'object') return;
      
      const functionNodes = [
        'FunctionDeclaration',
        'FunctionExpression',
        'ArrowFunctionExpression'
      ];
      
      if (functionNodes.includes(node.type)) {
        totalFunctions++;
        if (!hasSideEffects(node)) {
          pureFunctions++;
        }
      }
      
      for (const key in node) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else if (child && typeof child === 'object') {
          traverse(child);
        }
      }
    }
    
    traverse(ast);
    
    return totalFunctions === 0 ? 1.0 : pureFunctions / totalFunctions;
    
  } catch (error) {
    return 0.5; // Default if parsing fails
  }
}

/**
 * NOVEL METRIC 3: Decomposability Score
 * Measures how well code is broken into small, focused functions
 * AI tends to generate longer, monolithic components
 */
export function calculateDecomposability(code) {
  try {
    const ast = parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true }
    });
    
    const functionSizes = [];
    
    function traverse(node) {
      if (!node || typeof node !== 'object') return;
      
      const functionNodes = [
        'FunctionDeclaration',
        'FunctionExpression',
        'ArrowFunctionExpression'
      ];
      
      if (functionNodes.includes(node.type) && node.body) {
        // Count lines in function
        const funcCode = code.substring(node.range[0], node.range[1]);
        const lines = funcCode.split('\n').length;
        functionSizes.push(lines);
      }
      
      for (const key in node) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else if (child && typeof child === 'object') {
          traverse(child);
        }
      }
    }
    
    traverse(ast);
    
    if (functionSizes.length === 0) return 1.0;
    
    // Score based on % of functions under 50 lines
    const smallFunctions = functionSizes.filter(size => size <= 50).length;
    return smallFunctions / functionSizes.length;
    
  } catch (error) {
    return 0.5;
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
  return (
    0.25 * metrics.typeExplicitness +
    0.30 * metrics.pureFunctionRatio +
    0.20 * metrics.decomposability +
    0.15 * metrics.patternConsistency +
    0.10 * metrics.structuralPredictability
  );
}

/**
 * Analyze a single file and return all metrics
 */
export async function analyzeFile(filePath) {
  const code = await fs.readFile(filePath, 'utf-8');
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
    typeExplicitness: Number(typeExplicitness.toFixed(3)),
    pureFunctionRatio: Number(pureFunctionRatio.toFixed(3)),
    decomposability: Number(decomposability.toFixed(3)),
    patternConsistency: Number(patternConsistency.toFixed(3)),
    structuralPredictability: Number(structuralPredictability.toFixed(3)),
    // Composite AI metric
    acqi: Number(acqi.toFixed(3))
  };
}

export default {
  analyzeFile,
  calculateMcCabeComplexity,
  calculateCognitiveComplexity,
  calculateACQI
};
