const fs = require("fs");
const path = require("path");

function formatBytes(bytes) {
  if (bytes === 0) {
    return "0 Bytes";
  }
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function analyzeDirectory(dir, indent = "") {
  const stats = {};
  let totalSize = 0;

  try {
    const items = fs.readdirSync(dir);

    items.forEach((item) => {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        const subDirSize = analyzeDirectory(itemPath, indent + "  ");
        if (subDirSize > 0) {
          stats[item] = subDirSize;
          totalSize += subDirSize;
        }
      } else if (
        stat.isFile() &&
        (item.endsWith(".js") || item.endsWith(".css"))
      ) {
        totalSize += stat.size;
      }
    });
  } catch (err) {
    // Skip directories we can't access
  }

  return totalSize;
}

console.log("=== Next.js Bundle Analysis ===\n");

// Check if .next directory exists
if (!fs.existsSync(".next")) {
  console.log(
    'Error: .next directory not found. Please run "npm run build" first.',
  );
  process.exit(1);
}

// Analyze static files
if (fs.existsSync(".next/static")) {
  console.log("Static Assets:");
  const staticDir = ".next/static";
  const chunks = fs.existsSync(path.join(staticDir, "chunks"))
    ? analyzeDirectory(path.join(staticDir, "chunks"))
    : 0;
  const css = fs.existsSync(path.join(staticDir, "css"))
    ? analyzeDirectory(path.join(staticDir, "css"))
    : 0;
  const media = fs.existsSync(path.join(staticDir, "media"))
    ? analyzeDirectory(path.join(staticDir, "media"))
    : 0;

  console.log(`  - JavaScript chunks: ${formatBytes(chunks)}`);
  console.log(`  - CSS files: ${formatBytes(css)}`);
  console.log(`  - Media files: ${formatBytes(media)}`);
  console.log(`  - Total static: ${formatBytes(chunks + css + media)}\n`);
}

// Check package.json dependencies
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const deps = packageJson.dependencies || {};
const devDeps = packageJson.devDependencies || {};

console.log("Dependencies count:");
console.log(`  - Production: ${Object.keys(deps).length}`);
console.log(`  - Development: ${Object.keys(devDeps).length}\n`);

// List largest dependencies
console.log("Largest dependencies:");
const largeDeps = [
  "@radix-ui",
  "react-markdown",
  "@uiw/react-markdown-preview",
  "framer-motion",
  "react-hook-form",
  "axios",
  "swr",
  "zustand",
];

largeDeps.forEach((dep) => {
  const hasDep = Object.keys(deps).some((d) => d.includes(dep));
  if (hasDep) {
    console.log(`  ✓ ${dep}`);
  }
});

console.log("\n=== Recommendations ===");
console.log("1. Consider lazy loading for:");
console.log("   - Markdown editor (only on submit page)");
console.log("   - AI response comparison view");
console.log("   - Admin/moderation features");
console.log("\n2. Potential optimizations:");
console.log("   - Tree-shake unused Radix UI components");
console.log("   - Use dynamic imports for heavy components");
console.log("   - Optimize images with next/image");
