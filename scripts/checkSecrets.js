const { execSync } = require('child_process');
const fs = require('fs');

// Get list of staged files
let staged;
try {
  staged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
} catch (e) {
  console.error('Failed to get staged files:', e.message);
  process.exit(0); // don't block commits if git not available
}

if (staged.length === 0) process.exit(0);

// Safer narrow patterns for common secret formats
// Build some regexes without embedding the exact literal tokens in source
const suspiciousPatterns = [
  new RegExp('-----BEGIN ' + 'PRIVATE KEY-----'), // private key block but assembled to avoid literal in file
  new RegExp('AK' + 'IA' + '[0-9A-Z]{16}'), // AWS access key id
  new RegExp('sk' + '-[A-Za-z0-9]{24,}'), // OpenAI-like secret (assembled)
  new RegExp('AI' + 'za' + '[0-9A-Za-z_-]{35}'), // Google API key pattern (assembled)
  /APIFY_ACTOR_ID\s*[:=]\s*["']?[A-Za-z0-9_-]{6,}["']?/, // Apify actor id assignment
  /APIFY_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_-]{6,}["']?/, // Apify token assignment
];

let found = [];
// Skip scanning some common benign file types and explicitly safe files
const skipPatterns = [
  /^package.json$/i,
  /\.md$/i,
  /\.gitignore$/i,
  /\.env.example$/i,
  /^README\.?/i,
  /^\.githooks\//i,
  /^scripts\/checkSecrets\.js$/i,
  /^netlify\.toml$/i, // allow public keys in Netlify config
  /\.json$/i, // skip other json files by default (adjust if necessary)
];

for (const file of staged) {
  if (!fs.existsSync(file)) continue;
  if (skipPatterns.some((p) => p.test(file))) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      found.push({ file, pattern: pattern.toString() });
    }
  }
}

if (found.length > 0) {
  console.error('Potential secret patterns detected in staged files:');
  for (const f of found) {
    console.error(` - ${f.file} (pattern: ${f.pattern})`);
  }
  console.error('\nIf these are false positives, adjust scripts/checkSecrets.js. Otherwise, remove secrets and try again.');
  process.exit(1);
}

process.exit(0);
