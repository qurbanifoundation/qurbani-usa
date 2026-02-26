#!/bin/bash
# =============================================================================
# Install git hooks for safe deployment workflow
# Run once after cloning: bash scripts/setup-hooks.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

echo "Installing git hooks..."

cp "$SCRIPT_DIR/hooks/pre-push" "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/pre-push"

echo ""
echo "Done! Git hooks installed:"
echo "  - pre-push: Blocks accidental pushes to main"
echo ""
echo "Workflow reminder:"
echo "  1. Work on 'dev' branch"
echo "  2. Push to dev → auto-deploys preview"
echo "  3. Run 'npm run verify' before merging"
echo "  4. Merge dev → main → auto-deploys production"
echo ""
