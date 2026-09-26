# Installation & Quick Start Guide

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher

Check your versions:
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
```

If you need to install/update Node.js:
- Download from: https://nodejs.org/
- Or use nvm: https://github.com/nvm-sh/nvm

---

## Installation

### Option 1: Automated Setup (Recommended)

```bash
# Make setup script executable
chmod +x setup.sh

# Run setup
./setup.sh
```

### Option 2: Manual Setup

```bash
# Install dependencies
npm install

# Verify installation
node src/cli.js --help
```

---

## Quick Start

### 1. Analyze a Single Codebase

```bash
# Basic analysis
node src/cli.js analyze /path/to/react-app

# This creates: analysis-results.json
```

### 2. Analyze AI-Generated Code (with prompts)

```bash
node src/cli.js analyze /path/to/ai-generated-app \
  --type ai \
  --prompts /path/to/prompts.json \
  --output ai-app-results.json
```

**prompts.json format:**
```json
{
  "app_id": "todo-app-v1",
  "model": "gemini-pro-1.5",
  "initial_prompt": "Create a React todo app with TypeScript and Vite",
  "iterations": [
    {
      "iteration": 1,
      "prompt": "Add dark mode",
      "timestamp": "2026-02-10T14:23:00Z"
    }
  ],
  "total_iterations": 1
}
```

### 3. Analyze Human-Authored Code

```bash
node src/cli.js analyze /path/to/github-repo \
  --type human \
  --output human-app-results.json
```

### 4. Compare Multiple Codebases

After analyzing multiple codebases:

```bash
# Aggregate all results
node src/cli.js aggregate "results/*.json" \
  --output comparison.csv
```

This creates a CSV file you can import into Excel, R, or Python for statistical analysis.

---

## Command Reference

### `analyze` Command

```bash
node src/cli.js analyze <directory> [options]
```

**Arguments:**
- `<directory>` - Path to the React/Vite codebase

**Options:**
- `-o, --output <file>` - Output JSON file (default: `analysis-results.json`)
- `-t, --type <type>` - Code type: `human`, `ai`, or `unknown` (default: `unknown`)
- `-p, --prompts <file>` - JSON file with prompts (for AI code)
- `--exclude <patterns>` - Comma-separated exclusion patterns (default: `node_modules,dist,build,.git`)

**Examples:**

```bash
# Minimal
node src/cli.js analyze ./my-app

# Full options
node src/cli.js analyze ./my-app \
  --type ai \
  --prompts prompts.json \
  --output results/my-app.json \
  --exclude "node_modules,dist,build,.git,coverage"
```

### `aggregate` Command

```bash
node src/cli.js aggregate <pattern> [options]
```

**Arguments:**
- `<pattern>` - Glob pattern for JSON files (e.g., `"results/*.json"`)

**Options:**
- `-o, --output <file>` - Output CSV file (default: `aggregate-results.csv`)

**Example:**

```bash
node src/cli.js aggregate "results/*.json" --output study-results.csv
```

---

## Understanding the Output

### Individual Analysis Output (JSON)

```json
{
  "metadata": {
    "analyzedAt": "2026-02-12T10:30:00Z",
    "directory": "/path/to/app",
    "codeType": "ai",
    "totalFiles": 42,
    "totalLines": 5832,
    "totalSize": 189234
  },
  "aggregateStats": {
    "mccabeComplexity": {
      "mean": 8.3,
      "median": 6.0,
      "min": 1.0,
      "max": 45.0,
      "stdDev": 7.2
    },
    "cognitiveComplexity": {
      "mean": 12.4,
      "median": 10.0,
      "min": 1.0,
      "max": 38.0,
      "stdDev": 8.1
    },
    "acqi": {
      "mean": 0.742,
      "median": 0.768,
      "min": 0.312,
      "max": 0.953,
      "stdDev": 0.134
    },
    "typeExplicitness": {
      "mean": 0.856,
      "median": 0.920,
      "min": 0.450,
      "max": 1.000,
      "stdDev": 0.142
    },
    "pureFunctionRatio": {
      "mean": 0.673,
      "median": 0.700,
      "min": 0.200,
      "max": 1.000,
      "stdDev": 0.201
    }
  },
  "files": [
    {
      "file": "App.tsx",
      "path": "/full/path/to/App.tsx",
      "lines": 145,
      "size": 4821,
      "mccabeComplexity": 12,
      "cognitiveComplexity": 15,
      "typeExplicitness": 0.920,
      "pureFunctionRatio": 0.667,
      "decomposability": 0.800,
      "patternConsistency": 0.950,
      "structuralPredictability": 1.000,
      "acqi": 0.821
    }
  ]
}
```

### Aggregate Output (CSV)

```csv
source,type,mccabe_mean,mccabe_median,cognitive_mean,acqi_mean,acqi_median
app1,ai,8.3,6.0,12.4,0.742,0.768
app2,human,12.7,10.0,18.9,0.621,0.650
app3,ai,6.1,5.0,9.2,0.811,0.830
```

---

## Interpreting Results

### Traditional Metrics

**McCabe Cyclomatic Complexity:**
- ✅ **0-10**: Good (low complexity)
- ⚠️ **11-20**: Moderate (review recommended)
- 🔴 **>20**: High (refactor recommended)

**Cognitive Complexity:**
- ✅ **0-15**: Good (easy to understand)
- ⚠️ **16-30**: Moderate (may be confusing)
- 🔴 **>30**: High (likely hard to maintain)

### AI-Specific Metrics (0.0 - 1.0)

**Type Explicitness:**
- Higher is better (more explicit types)
- 0.8+ = Excellent type coverage

**Pure Function Ratio:**
- Higher is better (more testable)
- 0.7+ = Most functions are pure

**Decomposability:**
- Higher is better (smaller functions)
- 0.8+ = Well-decomposed code

**Pattern Consistency:**
- Higher is better (uniform naming)
- 0.9+ = Very consistent

**Structural Predictability:**
- Higher is better (follows conventions)
- 0.9+ = Standard patterns

### ACQI (Composite Score)

- **0.80 - 1.00**: A (Excellent AI-maintainability)
- **0.60 - 0.79**: B (Good)
- **0.40 - 0.59**: C (Moderate, needs improvement)
- **0.00 - 0.39**: D/F (Poor quality)

---

## Troubleshooting

### "Command not found: node"

Install Node.js from https://nodejs.org/

### "Cannot find module '@typescript-eslint/parser'"

Run the installation:
```bash
npm install
```

### "Error: ENOENT: no such file or directory"

Make sure the path to your codebase is correct:
```bash
# Use absolute path
node src/cli.js analyze /full/path/to/app

# Or relative path from current directory
node src/cli.js analyze ../my-react-app
```

### Analysis fails on certain files

The tool will skip files it can't parse and continue. Check the output for warnings.

### "No files found to analyze"

Make sure you're analyzing a React/TypeScript/JavaScript project with `.ts`, `.tsx`, `.js`, or `.jsx` files.

---

## Example Workflow

```bash
# 1. Set up the tool
./setup.sh

# 2. Create directories for organization
mkdir -p results/human
mkdir -p results/ai

# 3. Analyze your AI-generated apps
for app in ~/ai-apps/*; do
  app_name=$(basename "$app")
  node src/cli.js analyze "$app" \
    --type ai \
    --prompts "$app/prompts.json" \
    --output "results/ai/${app_name}.json"
done

# 4. Analyze human-authored apps from GitHub
for app in ~/github-repos/*; do
  app_name=$(basename "$app")
  node src/cli.js analyze "$app" \
    --type human \
    --output "results/human/${app_name}.json"
done

# 5. Aggregate all results
node src/cli.js aggregate "results/**/*.json" \
  --output final-comparison.csv

# 6. Open CSV in Excel/R/Python for analysis
```

---

## Next Steps

1. **Analyze your codebases** using the commands above
2. **Import CSV** into R or Python for statistical analysis
3. **See RESEARCH_WORKFLOW.md** for the complete research methodology
4. **See ACQI_EXAMPLES.md** for real-world examples

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the example workflow
3. See the full documentation in README.md

---

## File Structure

```
ai-code-quality-analyzer/
├── INSTALLATION.md          # This file
├── README.md                # Full documentation
├── THEORETICAL_FRAMEWORK.md # Academic justification
├── RESEARCH_WORKFLOW.md     # Research methodology
├── ACQI_EXAMPLES.md        # Real code examples
├── package.json            # Node.js dependencies
├── setup.sh                # Automated setup script
└── src/
    ├── analyzer.js         # Core analysis engine
    └── cli.js              # Command-line interface
```
