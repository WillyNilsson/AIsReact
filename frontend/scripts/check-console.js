#!/usr/bin/env node
/**
 * Script to check for console statements in production code
 * Part of Guardian standards enforcement
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// ANSI color codes
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

// Directories to check
const DIRS_TO_CHECK = ["app", "components", "hooks", "store", "lib", "utils"];

// Patterns to ignore
const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/*.test.{ts,tsx,js,jsx}",
  "**/*.spec.{ts,tsx,js,jsx}",
  "**/debug/**",
  "**/scripts/**",
];

// Console methods to check for
const CONSOLE_METHODS = [
  "console.log",
  "console.debug",
  "console.info",
  "console.trace",
  "console.dir",
  "console.table",
  "console.time",
  "console.timeEnd",
  "console.group",
  "console.groupEnd",
];

let totalViolations = 0;
const violations = {};

/**
 * Check a file for console statements
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const fileViolations = [];

  lines.forEach((line, index) => {
    // Skip commented lines
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) {
      return;
    }

    CONSOLE_METHODS.forEach((method) => {
      if (line.includes(method)) {
        fileViolations.push({
          line: index + 1,
          content: line.trim(),
          method,
        });
        totalViolations++;
      }
    });
  });

  if (fileViolations.length > 0) {
    violations[filePath] = fileViolations;
  }
}

/**
 * Main function
 */
function main() {
  console.log("🛡️  Checking for console statements in production code...\n");

  // Build glob patterns
  const patterns = DIRS_TO_CHECK.map((dir) =>
    path.join(dir, "**/*.{js,jsx,ts,tsx}"),
  );

  // Find all files
  const files = [];
  patterns.forEach((pattern) => {
    const matches = glob.sync(pattern, {
      ignore: IGNORE_PATTERNS,
    });
    files.push(...matches);
  });

  console.log(`Checking ${files.length} files...\n`);

  // Check each file
  files.forEach(checkFile);

  // Report results
  if (totalViolations === 0) {
    console.log(`${GREEN}✅ No console statements found!${RESET}\n`);
    process.exit(0);
  } else {
    console.log(
      `${RED}❌ Found ${totalViolations} console statement(s):${RESET}\n`,
    );

    Object.entries(violations).forEach(([file, fileViolations]) => {
      console.log(`${YELLOW}${file}:${RESET}`);
      fileViolations.forEach((violation) => {
        console.log(`  Line ${violation.line}: ${violation.method}`);
        console.log(`    ${violation.content}`);
      });
      console.log();
    });

    console.log(
      `${RED}Please remove all console statements before committing.${RESET}`,
    );
    console.log(
      `${YELLOW}Tip: Use proper logging service or error tracking instead.${RESET}\n`,
    );

    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
