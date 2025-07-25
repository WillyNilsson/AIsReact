#!/usr/bin/env node

/**
 * Node Version Checker for aisreact.com
 * 
 * This script checks if the current Node.js version meets the project requirements.
 * It provides helpful instructions for upgrading if the version is too old.
 */

const REQUIRED_NODE_VERSION = '22.0.0';
const REQUIRED_NODE_MAJOR = 22;

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function parseVersion(versionString) {
  const match = versionString.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid version string: ${versionString}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    full: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

function compareVersions(current, required) {
  const currentParsed = parseVersion(current);
  const requiredParsed = parseVersion(required);

  if (currentParsed.major > requiredParsed.major) return 1;
  if (currentParsed.major < requiredParsed.major) return -1;
  
  if (currentParsed.minor > requiredParsed.minor) return 1;
  if (currentParsed.minor < requiredParsed.minor) return -1;
  
  if (currentParsed.patch > requiredParsed.patch) return 1;
  if (currentParsed.patch < requiredParsed.patch) return -1;
  
  return 0;
}

function detectOS() {
  const platform = process.platform;
  if (platform === 'darwin') return 'macOS';
  if (platform === 'win32') return 'Windows';
  if (platform === 'linux') return 'Linux';
  return platform;
}

function getInstallInstructions(os) {
  const instructions = {
    macOS: `
${colorize('For macOS:', 'blue')}

${colorize('Option 1: Using nvm (Recommended)', 'bold')}
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  source ~/.zshrc  # or ~/.bashrc
  nvm install 22
  nvm use 22

${colorize('Option 2: Using Homebrew', 'bold')}
  brew install node@22

${colorize('Option 3: Direct Download', 'bold')}
  Visit https://nodejs.org/en/download/ and download the macOS installer
`,
    Windows: `
${colorize('For Windows:', 'blue')}

${colorize('Option 1: Using nvm-windows (Recommended)', 'bold')}
  1. Download nvm-windows from: https://github.com/coreybutler/nvm-windows/releases
  2. Install nvm-windows
  3. Open a new Command Prompt or PowerShell as Administrator
  4. Run: nvm install 22.0.0
  5. Run: nvm use 22.0.0

${colorize('Option 2: Using Chocolatey', 'bold')}
  choco install nodejs --version=22.0.0

${colorize('Option 3: Direct Download', 'bold')}
  Visit https://nodejs.org/en/download/ and download the Windows installer
`,
    Linux: `
${colorize('For Linux:', 'blue')}

${colorize('Option 1: Using nvm (Recommended)', 'bold')}
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  source ~/.bashrc
  nvm install 22
  nvm use 22

${colorize('Option 2: Using NodeSource (Ubuntu/Debian)', 'bold')}
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs

${colorize('Option 3: Using snap', 'bold')}
  sudo snap install node --channel=22/stable --classic
`,
  };

  return instructions[os] || instructions.Linux;
}

function checkNodeVersion() {
  console.log(colorize('\n🔍 Checking Node.js version...\n', 'bold'));

  const currentVersion = process.version;
  const currentParsed = parseVersion(currentVersion);
  
  console.log(`Current Node.js version: ${colorize(currentVersion, 'yellow')}`);
  console.log(`Required Node.js version: ${colorize(`v${REQUIRED_NODE_VERSION} or higher`, 'yellow')}\n`);

  const comparison = compareVersions(currentVersion, REQUIRED_NODE_VERSION);

  if (comparison >= 0) {
    console.log(colorize('✅ Node.js version check passed!', 'green'));
    console.log(`You're using Node.js ${currentVersion}, which meets the requirement.\n`);
    
    // Additional check for exact major version
    if (currentParsed.major > REQUIRED_NODE_MAJOR) {
      console.log(colorize('ℹ️  Note:', 'yellow'), `You're using Node.js ${currentParsed.major}, which is newer than the required version ${REQUIRED_NODE_MAJOR}.`);
      console.log('   The project should work fine, but if you encounter issues, consider using Node.js 22.x\n');
    }
    
    return true;
  } else {
    console.log(colorize('❌ Node.js version check failed!', 'red'));
    console.log(`You need to upgrade to Node.js ${REQUIRED_NODE_VERSION} or higher.\n`);
    
    const os = detectOS();
    console.log(colorize(`Installation instructions for ${os}:`, 'bold'));
    console.log(getInstallInstructions(os));
    
    console.log(colorize('After installing Node.js 22:', 'bold'));
    console.log('1. Close and reopen your terminal');
    console.log('2. Run "node --version" to verify the installation');
    console.log('3. Run this setup script again\n');
    
    // Check if .nvmrc exists
    const fs = require('fs');
    const path = require('path');
    const nvmrcPath = path.join(__dirname, '.nvmrc');
    
    if (fs.existsSync(nvmrcPath)) {
      console.log(colorize('💡 Tip:', 'yellow'), 'This project has an .nvmrc file.');
      console.log('   If you have nvm installed, you can simply run:');
      console.log(colorize('   nvm install', 'green'));
      console.log(colorize('   nvm use', 'green'));
      console.log('   This will automatically install and use the correct Node.js version.\n');
    }
    
    return false;
  }
}

// Export for use in other scripts
module.exports = { checkNodeVersion, REQUIRED_NODE_VERSION };

// Run if called directly
if (require.main === module) {
  const success = checkNodeVersion();
  process.exit(success ? 0 : 1);
}