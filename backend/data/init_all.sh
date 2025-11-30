#!/bin/bash

# ============================================================================
# Complete Database Initialization Script
# ============================================================================
# This script initializes the complete database system for the
# ATC Adaptive Alert Research System
# ============================================================================

echo ""
echo "============================================================"
echo "ATC Adaptive Alert Research System - Database Initialization"
echo "============================================================"
echo ""

# Change to script directory
cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 is not installed${NC}"
    echo "  Please install Python 3 to continue"
    exit 1
fi

echo -e "${GREEN}✓ Python 3 found${NC}"

# Check if database already exists
if [ -f "research_data.db" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Database file already exists${NC}"
    read -p "Do you want to backup and recreate? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        BACKUP_ARG="--backup --force"
    else
        echo "Skipping database creation"
        SKIP_CREATE=1
    fi
fi

# Create database
if [ -z "$SKIP_CREATE" ]; then
    echo ""
    echo -e "${BLUE}Creating database...${NC}"
    python3 setup_database.py --create $BACKUP_ARG

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database created successfully${NC}"
    else
        echo -e "${RED}✗ Failed to create database${NC}"
        exit 1
    fi
fi

# Verify database
echo ""
echo -e "${BLUE}Verifying database...${NC}"
python3 setup_database.py --verify

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Database verification failed${NC}"
    exit 1
fi

# Ask about test data
echo ""
read -p "Do you want to insert test data? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Inserting test data...${NC}"
    python3 setup_database.py --test-data

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Test data inserted${NC}"
    else
        echo -e "${RED}✗ Failed to insert test data${NC}"
    fi
fi

# Show statistics
echo ""
echo -e "${BLUE}Database statistics:${NC}"
python3 setup_database.py --stats

# Run example (optional)
echo ""
read -p "Do you want to run example usage? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Running examples...${NC}"
    python3 example_usage.py

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Examples completed successfully${NC}"
    fi
fi

# Summary
echo ""
echo "============================================================"
echo -e "${GREEN}Database Initialization Complete!${NC}"
echo "============================================================"
echo ""
echo "Database file: $(pwd)/research_data.db"
echo ""
echo "Next steps:"
echo "  1. Review the schema: cat schema.sql"
echo "  2. Read documentation: cat DATABASE_README.md"
echo "  3. See quick start: cat QUICK_START.md"
echo "  4. Run examples: python3 example_usage.py"
echo ""
echo "Useful commands:"
echo "  - Verify: python3 setup_database.py --verify"
echo "  - Stats:  python3 setup_database.py --stats"
echo "  - Backup: python3 setup_database.py --backup"
echo "  - Query:  sqlite3 research_data.db"
echo ""
echo "============================================================"
echo ""
