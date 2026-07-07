#!/bin/bash

# EMS Guardian Production Deployment Verification Script
# Verifies all production requirements are met before launch

set -e

echo "🔐 EMS Guardian Production Verification"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# 1. Check Node.js version
echo ""
echo "Checking environment..."
NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -ge 18 ]; then
    pass "Node.js $(node --version) installed"
else
    fail "Node.js 18+ required, found $(node --version)"
fi

# 2. Check npm
if command -v npm &> /dev/null; then
    pass "npm $(npm --version) installed"
else
    fail "npm not found"
fi

# 3. Check required files
echo ""
echo "Checking required files..."
FILES=(
    "package.json"
    "tsconfig.json"
    "vite.config.ts"
    "src/lib/security.ts"
    "src/lib/hipaaCompliance.ts"
    "src/lib/mayoClinicStandards.ts"
    "src/lib/auditLogger.ts"
    "src/lib/authManager.ts"
    "src/lib/productionConfig.ts"
    "src/components/PremiumUI.tsx"
    "Dockerfile.production"
    "docker-compose.production.yml"
    "nginx.conf"
    "DEPLOYMENT_GUIDE.md"
    "SECURITY_POLICY.md"
    "IMPLEMENTATION_CHECKLIST.md"
    "QUICK_START.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        pass "Found: $file"
    else
        fail "Missing: $file"
    fi
done

# 4. Check environment configuration
echo ""
echo "Checking environment configuration..."
if [ -f ".env.production" ]; then
    pass "Found .env.production"
    
    if grep -q "ENCRYPTION_KEY=" .env.production; then
        pass "ENCRYPTION_KEY configured"
    else
        warn "ENCRYPTION_KEY not set in .env.production"
    fi
    
    if grep -q "TOKEN_SECRET=" .env.production; then
        pass "TOKEN_SECRET configured"
    else
        warn "TOKEN_SECRET not set in .env.production"
    fi
else
    warn "No .env.production file found (use env.example.production as template)"
fi

# 5. Check dependencies
echo ""
echo "Checking production dependencies..."
if command -v npm &> /dev/null; then
    if grep -q '"crypto-js"' package.json; then
        pass "Security dependencies configured"
    else
        fail "Security dependencies not found in package.json"
    fi
    
    if grep -q '"bcryptjs"' package.json; then
        pass "Password hashing available"
    else
        warn "bcryptjs not in package.json"
    fi
fi

# 6. Check build
echo ""
echo "Checking build configuration..."
if [ -f "vite.config.ts" ]; then
    pass "Vite configuration found"
else
    fail "vite.config.ts not found"
fi

# 7. Check Docker
echo ""
echo "Checking Docker configuration..."
if command -v docker &> /dev/null; then
    pass "Docker installed ($(docker --version))"
    
    if [ -f "Dockerfile.production" ]; then
        pass "Production Dockerfile found"
    else
        fail "Production Dockerfile not found"
    fi
else
    warn "Docker not installed (required for containerized deployment)"
fi

if command -v docker-compose &> /dev/null; then
    pass "Docker Compose installed"
else
    warn "Docker Compose not installed (required for full stack deployment)"
fi

# 8. Check security
echo ""
echo "Checking security configuration..."
if grep -q "hipaaCompliance" src/lib/*.ts || grep -r "hipaaCompliance" src/ &>/dev/null; then
    pass "HIPAA compliance module integrated"
else
    fail "HIPAA compliance module not found"
fi

if grep -r "encryption" src/lib/*.ts &>/dev/null; then
    pass "Encryption module integrated"
else
    fail "Encryption module not found"
fi

if grep -q "auditLogger" src/lib/*.ts || grep -r "auditLogger" src/ &>/dev/null; then
    pass "Audit logging integrated"
else
    fail "Audit logging module not found"
fi

# 9. Check clinical standards
echo ""
echo "Checking clinical standards..."
if grep -q "mayoClinicStandards" src/lib/*.ts || grep -r "mayoClinicStandards" src/ &>/dev/null; then
    pass "Mayo Clinic standards integrated"
else
    fail "Mayo Clinic standards not found"
fi

# 10. Check documentation
echo ""
echo "Checking documentation..."
DOCS=(
    "DEPLOYMENT_GUIDE.md"
    "SECURITY_POLICY.md"
    "IMPLEMENTATION_CHECKLIST.md"
    "QUICK_START.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ] && [ -s "$doc" ]; then
        pass "Documentation: $doc ($(wc -l < $doc) lines)"
    else
        fail "Missing or empty: $doc"
    fi
done

# Summary
echo ""
echo "======================================"
echo "Verification Summary"
echo "======================================"
echo -e "${GREEN}Passed:${NC}  $PASSED"
echo -e "${RED}Failed:${NC}  $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo "======================================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed - Ready for production deployment!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some checks failed - Please review above${NC}"
    exit 1
fi
