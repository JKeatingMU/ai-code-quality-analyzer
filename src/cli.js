#!/usr/bin/env node

/**
 * AI Code Quality Analyzer - Command Line Interface
 * 
 * Usage:
 *   acqa analyze <directory> --output results.json
 *   acqa analyze <directory> --type human|ai --prompts prompts.json
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';

const program = new Command();

program
  .name('acqa')
  .description('AI Code Quality Analyzer - Research tool for evaluating AI vs human-generated code')
  .version('2.0.0');

program
  .command('analyze')
  .description('Analyze a React/Vite codebase')
  .argument('<directory>', 'Path to codebase root directory')
  .option('-o, --output <file>', 'Output JSON file', 'analysis-results.json')
  .option('-t, --type <type>', 'Code type: human|ai|unknown', 'unknown')
  .option('-p, --prompts <file>', 'JSON file containing prompts (for AI-generated code)')
  .option('--exclude <patterns>', 'Comma-separated glob patterns to exclude', 'node_modules,dist,build,.git')
  .option('--legacy', 'Use metrics version 1 (reproduces results published before September 2026)')
  .action(async (directory, options) => {
    const { analyzeFile } = await import(options.legacy ? './analyzer-v1.js' : './analyzer.js');
    const metricsVersion = options.legacy ? 1 : 2;
    console.log(chalk.blue.bold('\n🔬 AI Code Quality Analyzer\n'));
    console.log(chalk.gray(`Directory: ${directory}`));
    console.log(chalk.gray(`Type: ${options.type}`));
    console.log(chalk.gray(`Metrics version: ${metricsVersion}${options.legacy ? ' (legacy)' : ''}\n`));
    
    const spinner = ora('Scanning for TypeScript/JavaScript files...').start();
    
    try {
      // Find all relevant files
      const patterns = [
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx'
      ];
      
      const excludePatterns = options.exclude.split(',').map(p => `**/${p}/**`);
      
      const files = await glob(patterns, {
        cwd: directory,
        absolute: true,
        ignore: excludePatterns
      });
      
      spinner.succeed(`Found ${chalk.green(files.length)} files to analyze`);
      
      // Analyze each file
      const results = [];
      let analyzed = 0;
      
      for (const file of files) {
        const progressSpinner = ora(`Analyzing (${++analyzed}/${files.length}): ${path.basename(file)}`).start();
        
        try {
          const analysis = await analyzeFile(file);
          results.push(analysis);
          progressSpinner.succeed();
        } catch (error) {
          progressSpinner.fail(`Error analyzing ${path.basename(file)}: ${error.message}`);
        }
      }
      
      // Load prompts if provided
      let prompts = null;
      if (options.prompts) {
        try {
          const promptData = await fs.readFile(options.prompts, 'utf-8');
          prompts = JSON.parse(promptData);
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Could not load prompts file: ${error.message}`));
        }
      }
      
      // Calculate aggregate statistics
      const stats = calculateAggregateStats(results);
      
      // Prepare output
      const output = {
        metadata: {
          analyzedAt: new Date().toISOString(),
          directory: path.resolve(directory),
          codeType: options.type,
          acqaVersion: '2.0.0',
          metricsVersion,
          totalFiles: results.length,
          totalLines: results.reduce((sum, r) => sum + r.lines, 0),
          totalSize: results.reduce((sum, r) => sum + r.size, 0)
        },
        aggregateStats: stats,
        prompts: prompts,
        files: results
      };
      
      // Write results
      await fs.writeFile(options.output, JSON.stringify(output, null, 2));
      
      console.log(chalk.green.bold('\n✅ Analysis Complete!\n'));
      displaySummary(stats);
      console.log(chalk.gray(`\nResults saved to: ${options.output}\n`));
      
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('aggregate')
  .description('Aggregate multiple analysis results for comparison')
  .argument('<pattern>', 'Glob pattern for JSON result files (e.g., "results/*.json")')
  .option('-o, --output <file>', 'Output aggregated CSV file', 'aggregate-results.csv')
  .action(async (pattern, options) => {
    console.log(chalk.blue.bold('\n📊 Aggregating Analysis Results\n'));
    
    const spinner = ora('Finding result files...').start();
    
    try {
      const files = await glob(pattern);
      spinner.succeed(`Found ${chalk.green(files.length)} result files`);
      
      const allResults = [];
      
      for (const file of files) {
        const data = JSON.parse(await fs.readFile(file, 'utf-8'));
        allResults.push({
          source: path.basename(file, '.json'),
          type: data.metadata.codeType,
          ...data.aggregateStats
        });
      }
      
      // Generate CSV
      const csv = generateCSV(allResults);
      await fs.writeFile(options.output, csv);
      
      console.log(chalk.green.bold('\n✅ Aggregation Complete!\n'));
      console.log(chalk.gray(`Results saved to: ${options.output}\n`));
      
    } catch (error) {
      spinner.fail('Aggregation failed');
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

function calculateAggregateStats(results) {
  if (results.length === 0) return {};
  
  const metrics = [
    'mccabeComplexity',
    'cognitiveComplexity',
    'typeExplicitness',
    'pureFunctionRatio',
    'decomposability',
    'patternConsistency',
    'structuralPredictability',
    'acqi'
  ];
  
  const stats = {};
  
  metrics.forEach(metric => {
    const values = results.map(r => r[metric]).filter(v => v != null);
    if (values.length === 0) return;
    
    const sorted = values.sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    stats[metric] = {
      mean: Number((sum / values.length).toFixed(3)),
      median: Number(sorted[Math.floor(values.length / 2)].toFixed(3)),
      min: Number(Math.min(...values).toFixed(3)),
      max: Number(Math.max(...values).toFixed(3)),
      stdDev: Number(calculateStdDev(values).toFixed(3))
    };
  });
  
  return stats;
}

function calculateStdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function displaySummary(stats) {
  console.log(chalk.bold('Traditional Metrics:'));
  console.log(`  McCabe Complexity:     Mean=${chalk.cyan(stats.mccabeComplexity?.mean)}, Median=${chalk.cyan(stats.mccabeComplexity?.median)}`);
  console.log(`  Cognitive Complexity:  Mean=${chalk.cyan(stats.cognitiveComplexity?.mean)}, Median=${chalk.cyan(stats.cognitiveComplexity?.median)}`);
  
  console.log(chalk.bold('\nAI-Specific Metrics:'));
  console.log(`  Type Explicitness:     Mean=${chalk.cyan(stats.typeExplicitness?.mean)}, Median=${chalk.cyan(stats.typeExplicitness?.median)}`);
  console.log(`  Pure Function Ratio:   Mean=${chalk.cyan(stats.pureFunctionRatio?.mean)}, Median=${chalk.cyan(stats.pureFunctionRatio?.median)}`);
  console.log(`  Decomposability:       Mean=${chalk.cyan(stats.decomposability?.mean)}, Median=${chalk.cyan(stats.decomposability?.median)}`);
  console.log(`  Pattern Consistency:   Mean=${chalk.cyan(stats.patternConsistency?.mean)}, Median=${chalk.cyan(stats.patternConsistency?.median)}`);
  console.log(`  Structural Predict.:   Mean=${chalk.cyan(stats.structuralPredictability?.mean)}, Median=${chalk.cyan(stats.structuralPredictability?.median)}`);
  
  console.log(chalk.bold.green(`\n  AI-Code Quality Index (ACQI): ${stats.acqi?.mean}`));
}

function generateCSV(results) {
  const headers = [
    'source',
    'type',
    'mccabe_mean',
    'mccabe_median',
    'cognitive_mean',
    'cognitive_median',
    'type_explicitness_mean',
    'pure_function_ratio_mean',
    'decomposability_mean',
    'pattern_consistency_mean',
    'structural_predictability_mean',
    'acqi_mean',
    'acqi_median'
  ];
  
  const rows = results.map(r => [
    r.source,
    r.type,
    r.mccabeComplexity?.mean ?? '',
    r.mccabeComplexity?.median ?? '',
    r.cognitiveComplexity?.mean ?? '',
    r.cognitiveComplexity?.median ?? '',
    r.typeExplicitness?.mean ?? '',
    r.pureFunctionRatio?.mean ?? '',
    r.decomposability?.mean ?? '',
    r.patternConsistency?.mean ?? '',
    r.structuralPredictability?.mean ?? '',
    r.acqi?.mean ?? '',
    r.acqi?.median ?? ''
  ].join(','));
  
  return [headers.join(','), ...rows].join('\n');
}

program.parse();
