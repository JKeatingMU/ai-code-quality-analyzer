#!/bin/bash
# Quick Setup Script for AI Code Quality Analyzer

echo "🔬 AI Code Quality Analyzer - Setup"
echo "===================================="
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be >= 18.0.0 (current: $(node -v))"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Quick Start:"
echo "------------"
echo "1. Analyze a codebase:"
echo "   node src/cli.js analyze /path/to/react-app"
echo ""
echo "2. With prompts (for AI code):"
echo "   node src/cli.js analyze /path/to/ai-app --type ai --prompts prompts.json"
echo ""
echo "3. Aggregate results:"
echo "   node src/cli.js aggregate 'results/*.json' --output comparison.csv"
echo ""
echo "📚 See README.md for full documentation"
