require('dotenv').config({ path: '../../.env' });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PROJECT_ROOT = path.join(__dirname, '../../');
const FRONTEND_ROOT = path.join(PROJECT_ROOT, 'frontend');
const BACKEND_ROOT = path.join(PROJECT_ROOT, 'backend');

// ─── Vérification syntaxe JS/JSX via Node ────────────────
function checkSyntax(filePath) {
  try {
    execSync('node --check "' + filePath + '"', { stdio: 'pipe' });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.stderr.toString() || err.stdout.toString() };
  }
}

// ─── Build Vite pour détecter les erreurs ─────────────────
function buildFrontend() {
  try {
    const result = execSync('npm run build 2>&1', {
      cwd: FRONTEND_ROOT,
      stdio: 'pipe',
      timeout: 60000,
    });
    return { ok: true, output: result.toString() };
  } catch (err) {
    const output = (err.stdout || '').toString() + (err.stderr || '').toString();
    return { ok: false, error: output };
  }
}

// ─── Parser les erreurs Vite ──────────────────────────────
function parseViteErrors(errorOutput) {
  const errors = [];

  // Pattern : [plugin:vite:react-babel] fichier.jsx: Message (ligne:col)
  const babelPattern = /\[plugin:vite[^\]]*\]\s*([^:]+\.jsx?):\s*([^\n]+)\n.*?(\d+:\d+)/g;
  let match;
  while ((match = babelPattern.exec(errorOutput)) !== null) {
    errors.push({
      file: match[1].trim(),
      message: match[2].trim(),
      location: match[3],
    });
  }

  // Pattern : Error: fichier.jsx ligne X
  const genericPattern = /(?:Error|SyntaxError)[^:]*:\s*([^\n]+)\n[^(]*\(([^)]+)\)/g;
  while ((match = genericPattern.exec(errorOutput)) !== null) {
    errors.push({
      file: 'unknown',
      message: match[1].trim(),
      location: match[2],
    });
  }

  // Si pas de pattern spécifique, extraire les chemins de fichiers mentionnés
  if (errors.length === 0) {
    const filePattern = /frontend[/\\]src[/\\][^\s:'"]+\.(jsx?|tsx?)/g;
    const files = new Set();
    while ((match = filePattern.exec(errorOutput)) !== null) {
      files.add(match[0].replace(/\\/g, '/'));
    }
    files.forEach(f => errors.push({ file: f, message: errorOutput.substring(0, 300), location: '' }));
  }

  return errors;
}

// ─── Lire un fichier du projet ────────────────────────────
function readProjectFile(relativePath) {
  const candidates = [
    path.join(PROJECT_ROOT, relativePath),
    path.join(PROJECT_ROOT, 'frontend', relativePath),
    path.join(PROJECT_ROOT, relativePath.replace('frontend/', '')),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { path: candidate, content: fs.readFileSync(candidate, 'utf-8') };
    }
  }
  return null;
}

// ─── Écriture sécurisée ───────────────────────────────────
function writeProjectFile(filePath, content) {
  // Backup
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath + '.bak', fs.readFileSync(filePath));
  }

  // Nettoyer le markdown résiduel
  let clean = content;
  const blockMatch = content.match(/```(?:jsx?|tsx?|javascript|typescript|js|ts)?\n([\s\S]*?)```/);
  if (blockMatch) {
    clean = blockMatch[1].trim();
  } else {
    // Chercher le début du code
    const lines = content.split('\n');
    const codeStart = lines.findIndex(l =>
      l.startsWith('import ') || l.startsWith('const ') ||
      l.startsWith('export ') || l.startsWith('function ') ||
      l.startsWith('require(')
    );
    if (codeStart > 0) clean = lines.slice(codeStart).join('\n').trim();
  }

  fs.writeFileSync(filePath, clean, 'utf-8');
}

// ─── Agent de debug ───────────────────────────────────────
async function fixError(errorInfo, retryCount = 0) {
  if (retryCount >= 3) {
    console.error('[DebugAgent] Max retries atteint pour cette erreur.');
    return false;
  }

  const { file, message, location } = errorInfo;
  console.log('[DebugAgent] Correction de : ' + file + ' - ' + message);

  // Lire le fichier problématique
  const fileData = readProjectFile(file);
  if (!fileData) {
    console.error('[DebugAgent] Fichier introuvable : ' + file);
    return false;
  }

  const prompt = [
    'Tu es un agent de debug expert React/JavaScript.',
    'Corrige UNIQUEMENT l\'erreur décrite. Ne change rien d\'autre.',
    '',
    'ERREUR : ' + message,
    'FICHIER : ' + file,
    'POSITION : ' + (location || 'inconnue'),
    '',
    'CODE ACTUEL :',
    fileData.content,
    '',
    'Retourne UNIQUEMENT le code corrigé complet, sans markdown, sans explication.',
    'Le fichier doit commencer directement par "import" ou "const" ou "export".',
  ].join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 4096,
  });

  const fixedCode = response.choices[0].message.content;
  writeProjectFile(fileData.path, fixedCode);
  console.log('[DebugAgent] Fichier corrigé : ' + fileData.path);
  return true;
}

// ─── Boucle de debug principale ───────────────────────────
async function runDebugCycle() {
  console.log('[DebugAgent] Vérification du build frontend...');

  const build = buildFrontend();

  if (build.ok) {
    console.log('[DebugAgent] Build OK, aucune erreur détectée.');
    return { hasErrors: false };
  }

  console.log('[DebugAgent] Erreurs détectées, analyse...');
  const errors = parseViteErrors(build.error);

  if (errors.length === 0) {
    console.log('[DebugAgent] Impossible de parser les erreurs :\n' + build.error.substring(0, 500));
    return { hasErrors: true, fixed: 0, errors: [] };
  }

  console.log('[DebugAgent] ' + errors.length + ' erreur(s) trouvée(s)');

  let fixed = 0;
  for (const error of errors) {
    const success = await fixError(error);
    if (success) fixed++;
  }

  // Re-vérifier après corrections
  if (fixed > 0) {
    console.log('[DebugAgent] Re-vérification après ' + fixed + ' correction(s)...');
    const rebuild = buildFrontend();
    return {
      hasErrors: !rebuild.ok,
      fixed,
      remainingErrors: rebuild.ok ? [] : parseViteErrors(rebuild.error),
    };
  }

  return { hasErrors: true, fixed: 0, errors };
}

module.exports = { runDebugCycle, checkSyntax, buildFrontend, fixError, parseViteErrors };
