/**
 * BudgetQuest - Équipe intelligente d'agents
 *
 * Processus par cycle :
 *  1. SCAN      — Lire tout le code existant
 *  2. BRAINSTORM — Les agents débattent et proposent des idées
 *  3. PLAN      — Un chef de projet sélectionne et détaille UNE tâche
 *  4. IMPLEMENT — L'agent implémente avec le contexte complet
 *  5. REVIEW    — Un reviewer critique le code produit
 *  6. FIX       — L'implémenteur corrige si nécessaire (max 2 passes)
 *  7. BUILD     — Vite build pour valider la compilation
 *  8. PUSH      — Commit et push seulement si tout est vert
 *
 * Une seule tâche par cycle, bien faite.
 */

require('dotenv').config({ path: '../.env' });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { notify, notifyError, askHuman } = require('./telegram');
const { commitAndPush } = require('./agents/devopsAgent');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PROJECT_ROOT = path.join(__dirname, '../');
const DONE_FILE = path.join(__dirname, '.done_tasks.json');

// ─── Config ──────────────────────────────────────────────
const CYCLE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes entre cycles

// ─── Mémoire ─────────────────────────────────────────────
function loadDone() {
  if (!fs.existsSync(DONE_FILE)) return [];
  return JSON.parse(fs.readFileSync(DONE_FILE, 'utf-8'));
}
function saveDone(task) {
  const done = loadDone();
  done.push({ task, at: new Date().toISOString() });
  fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
}

// ─── Scanner le projet ───────────────────────────────────
function scanProject() {
  const files = {};
  const dirs = [
    'frontend/src/pages',
    'frontend/src/components',
    'frontend/src/store',
    'frontend/src/lib',
    'backend/src/routes',
    'backend/src',
  ];

  for (const dir of dirs) {
    const full = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(full)) continue;
    fs.readdirSync(full).forEach(f => {
      if (!f.match(/\.(js|jsx)$/)) return;
      const rel = dir + '/' + f;
      const content = fs.readFileSync(path.join(full, f), 'utf-8');
      files[rel] = content;
    });
  }
  return files;
}

// ─── Appel GPT avec retry ─────────────────────────────────
async function gpt(systemMsg, userMsg, json = false) {
  const opts = {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg },
    ],
    temperature: json ? 0.1 : 0.4,
    max_tokens: 4096,
  };
  if (json) opts.response_format = { type: 'json_object' };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await openai.chat.completions.create(opts);
      return res.choices[0].message.content;
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// ─── ÉTAPE 1 : BRAINSTORM ─────────────────────────────────
async function brainstorm(projectFiles, doneTasks) {
  console.log('\n[Team] 🧠 Étape 1/6 — Brainstorm...');

  const fileList = Object.keys(projectFiles).join('\n');
  const doneList = doneTasks.slice(-15).map(t => '- ' + t.task).join('\n') || 'Aucune';

  // Agent Frontend propose
  const frontendIdeas = await gpt(
    'Tu es un développeur frontend senior React/TailwindCSS qui travaille sur BudgetQuest, une app de gestion de budget gamifiée (RPG). Tu dois proposer des améliorations concrètes et impactantes pour les utilisateurs. Sois créatif mais réaliste.',
    'Voici les fichiers existants :\n' + fileList +
    '\n\nTâches déjà faites :\n' + doneList +
    '\n\nPropose 3 améliorations frontend prioritaires. Pour chaque idée : titre, impact utilisateur, complexité (faible/moyenne/haute), risque (modifier fichier existant vs créer nouveau fichier).'
  );

  // Agent Backend propose
  const backendIdeas = await gpt(
    'Tu es un développeur backend senior Node.js/Express/Supabase qui travaille sur BudgetQuest. Tu dois proposer des améliorations concrètes côté API, données et logique métier.',
    'Voici les fichiers existants :\n' + fileList +
    '\n\nTâches déjà faites :\n' + doneList +
    '\n\nPropose 3 améliorations backend prioritaires. Pour chaque idée : titre, impact utilisateur, complexité, risque.'
  );

  // Agent UX/Qualité critique
  const uxCritique = await gpt(
    'Tu es un expert UX et qualité qui review les propositions de l\'équipe. Tu identifies les risques, les doublons, et tu priorises selon l\'impact réel sur l\'utilisateur.',
    'Voici les propositions de l\'équipe :\n\nFRONTEND :\n' + frontendIdeas +
    '\n\nBACKEND :\n' + backendIdeas +
    '\n\nAnalyse ces propositions. Quelles sont les 2 meilleures selon toi et pourquoi ? Quelles sont les plus risquées ?'
  );

  return { frontendIdeas, backendIdeas, uxCritique };
}

// ─── ÉTAPE 2 : PLAN ──────────────────────────────────────
async function plan(brainstormResult, projectFiles) {
  console.log('[Team] 📋 Étape 2/6 — Planification...');

  const allFiles = Object.entries(projectFiles)
    .map(([f, c]) => '=== ' + f + ' ===\n' + c.substring(0, 600))
    .join('\n\n');

  const result = await gpt(
    'Tu es le chef de projet de BudgetQuest. Tu sélectionnes UNE seule tâche à implémenter ce cycle, basée sur le brainstorm de l\'équipe. Tu dois choisir la tâche avec le meilleur rapport impact/risque. Réponds en json.',
    'BRAINSTORM DE L\'ÉQUIPE :\n\n' +
    'Frontend a proposé :\n' + brainstormResult.frontendIdeas +
    '\n\nBackend a proposé :\n' + brainstormResult.backendIdeas +
    '\n\nAnalyse UX/Qualité :\n' + brainstormResult.uxCritique +
    '\n\nFICHIERS EXISTANTS (extraits) :\n' + allFiles.substring(0, 3000) +
    '\n\nSélectionne UNE tâche. Retourne ce json exact :\n' +
    '{"agent":"frontend"|"backend","title":"...","why":"pourquoi cette tâche maintenant","outputFile":"frontend/src/.../fichier.jsx ou null si modification","filesToModify":["liste des fichiers existants à modifier"],"spec":"description technique très détaillée de ce qui doit être implémenté, ligne par ligne si nécessaire","risks":"risques identifiés","doneCheck":"comment vérifier que c\'est bien fait"}',
    true
  );

  return JSON.parse(result);
}

// ─── ÉTAPE 3 : IMPLEMENT ─────────────────────────────────
async function implement(task, projectFiles) {
  console.log('[Team] ⚙️ Étape 3/6 — Implémentation par agent ' + task.agent + '...');

  // Donner le contexte COMPLET des fichiers concernés
  const relevantFiles = {};
  const allKeys = Object.keys(projectFiles);

  // Fichiers à modifier
  (task.filesToModify || []).forEach(f => {
    const key = allKeys.find(k => k.includes(f.split('/').pop()));
    if (key) relevantFiles[key] = projectFiles[key];
  });

  // Fichiers de contexte selon le type d'agent
  if (task.agent === 'frontend') {
    ['App.jsx', 'index.css', 'api.js', 'authStore.js'].forEach(name => {
      const key = allKeys.find(k => k.endsWith(name));
      if (key) relevantFiles[key] = projectFiles[key];
    });
  } else {
    ['index.js', 'supabase.js', 'auth.js'].forEach(name => {
      const key = allKeys.find(k => k.endsWith(name));
      if (key) relevantFiles[key] = projectFiles[key];
    });
  }

  const contextStr = Object.entries(relevantFiles)
    .map(([f, c]) => '=== ' + f + ' (COMPLET) ===\n' + c)
    .join('\n\n');

  const systemMsg = task.agent === 'frontend'
    ? [
        'Tu es un développeur frontend expert React/TailwindCSS.',
        'RÈGLES ABSOLUES :',
        '1. Retourne UNIQUEMENT du code source pur, sans markdown, sans explication.',
        '2. Le code doit commencer par "import" ou "const" ou "export".',
        '3. Ne crée PAS de nouveaux imports de fichiers qui n\'existent pas encore.',
        '4. Utilise uniquement les imports déjà présents dans le projet.',
        '5. Un seul composant par fichier.',
        '6. Teste mentalement chaque ligne avant de l\'écrire.',
      ].join('\n')
    : [
        'Tu es un développeur backend expert Node.js/Express.',
        'RÈGLES ABSOLUES :',
        '1. Retourne UNIQUEMENT du code source pur, sans markdown, sans explication.',
        '2. Le code doit commencer par "require(" ou "const" ou "module.exports".',
        '3. Ne crée PAS de nouveaux imports de fichiers qui n\'existent pas.',
        '4. Valide toutes les entrées utilisateur.',
        '5. Teste mentalement chaque ligne avant de l\'écrire.',
      ].join('\n');

  const code = await gpt(
    systemMsg,
    'SPEC DE LA TÂCHE :\n' + task.spec +
    '\n\nRISQUES À ÉVITER :\n' + task.risks +
    '\n\nCONTEXTE DU PROJET (fichiers complets) :\n' + contextStr
  );

  return code;
}

// ─── ÉTAPE 4 : REVIEW ────────────────────────────────────
async function review(task, code, projectFiles) {
  console.log('[Team] 🔍 Étape 4/6 — Review par agent qualité...');

  const contextKey = Object.keys(projectFiles).find(k =>
    task.outputFile ? k.includes(task.outputFile.split('/').pop()) : false
  );
  const existingCode = contextKey ? projectFiles[contextKey] : '';

  const reviewResult = await gpt(
    'Tu es un reviewer de code senior. Tu analyses le code produit et identifies les bugs, les imports manquants, les incohérences avec le projet. Sois précis et factuel. Réponds en json.',
    'TÂCHE DEMANDÉE :\n' + task.spec +
    '\n\nCODE EXISTANT (avant modification) :\n' + (existingCode || 'Nouveau fichier') +
    '\n\nCODE PRODUIT :\n' + code +
    '\n\nFICHIERS DU PROJET (pour vérifier les imports) :\n' + Object.keys(projectFiles).join('\n') +
    '\n\nRéponds avec ce json exact :\n' +
    '{"approved":true|false,"score":0-10,"issues":["liste des problèmes"],"fixes":["corrections suggérées"],"summary":"résumé en 1 phrase"}',
    true
  );

  return JSON.parse(reviewResult);
}

// ─── ÉTAPE 5 : FIX si review KO ──────────────────────────
async function fixCode(task, code, reviewIssues) {
  console.log('[Team] 🔧 Étape 5/6 — Correction suite au review...');

  const systemMsg = [
    'Tu es un développeur expert qui corrige du code suite à une review.',
    'RÈGLES ABSOLUES :',
    '1. Retourne UNIQUEMENT le code corrigé complet, sans markdown.',
    '2. Corrige EXACTEMENT les problèmes listés, ne change rien d\'autre.',
    '3. Un seul composant par fichier.',
  ].join('\n');

  const fixed = await gpt(
    systemMsg,
    'CODE À CORRIGER :\n' + code +
    '\n\nPROBLÈMES IDENTIFIÉS :\n' + reviewIssues.join('\n') +
    '\n\nCORRECTIONS SUGGÉRÉES :\n' + (task.fixes || []).join('\n')
  );

  return fixed;
}

// ─── ÉTAPE 6 : BUILD CHECK ───────────────────────────────
function buildCheck() {
  console.log('[Team] 🏗️ Étape 6/6 — Vérification build...');
  try {
    execSync('npm run build', {
      cwd: path.join(PROJECT_ROOT, 'frontend'),
      stdio: 'pipe',
      timeout: 90000,
    });
    return { ok: true };
  } catch (err) {
    const output = (err.stdout || '').toString() + '\n' + (err.stderr || '').toString();
    return { ok: false, error: output };
  }
}

// ─── Écriture fichier ─────────────────────────────────────
function writeFile(relPath, content) {
  const fullPath = path.join(PROJECT_ROOT, relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Backup
  if (fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath + '.bak', fs.readFileSync(fullPath));
  }

  // Nettoyer markdown résiduel
  let clean = content.trim();
  const blockMatch = clean.match(/```(?:jsx?|tsx?|js|ts)?\n?([\s\S]*?)```/);
  if (blockMatch) clean = blockMatch[1].trim();

  // Détecter début de code
  const lines = clean.split('\n');
  const start = lines.findIndex(l =>
    l.startsWith('import ') || l.startsWith('const ') ||
    l.startsWith('export ') || l.startsWith('function ') ||
    l.startsWith('require(')
  );
  if (start > 0) clean = lines.slice(start).join('\n').trim();

  fs.writeFileSync(fullPath, clean, 'utf-8');
  console.log('[Team] ✅ Fichier écrit : ' + relPath);
}

// ─── CYCLE COMPLET ───────────────────────────────────────
async function runSmartCycle(cycleNum) {
  const separator = '═'.repeat(55);
  console.log('\n' + separator);
  console.log('[Team] 🔄 Cycle #' + cycleNum + ' démarré à ' + new Date().toLocaleTimeString());
  console.log(separator);

  try {
    // 1. Scanner le projet
    console.log('[Team] 📂 Scan du projet...');
    const projectFiles = scanProject();
    const doneTasks = loadDone();
    console.log('[Team] ' + Object.keys(projectFiles).length + ' fichiers scannés, ' + doneTasks.length + ' tâches passées en mémoire.');

    // 2. Brainstorm
    const brainstormResult = await brainstorm(projectFiles, doneTasks);

    // Notifier l'humain du brainstorm (informatif)
    await notify(
      '🧠 *Cycle #' + cycleNum + ' — Brainstorm terminé*\n\n' +
      '*Frontend propose :*\n' + brainstormResult.frontendIdeas.substring(0, 300) + '...\n\n' +
      '*UX critique :*\n' + brainstormResult.uxCritique.substring(0, 200) + '...'
    );

    // 3. Plan — sélection d'UNE tâche
    const task = await plan(brainstormResult, projectFiles);
    console.log('[Team] 📌 Tâche sélectionnée : ' + task.title);
    console.log('[Team] 📌 Pourquoi : ' + task.why);

    await notify(
      '📋 *Tâche sélectionnée :*\n\n' +
      '🎯 *' + task.title + '*\n' +
      '_' + task.why + '_\n\n' +
      '⚠️ Risques : ' + task.risks
    );

    // 4. Implémenter
    let code = await implement(task, projectFiles);

    // 5. Review
    let reviewResult = await review(task, code, projectFiles);
    console.log('[Team] 📊 Review score : ' + reviewResult.score + '/10 — Approuvé : ' + reviewResult.approved);

    // 6. Corriger si nécessaire (max 2 passes)
    let fixPasses = 0;
    while (!reviewResult.approved && fixPasses < 2) {
      console.log('[Team] 🔧 Pass de correction #' + (fixPasses + 1) + '...');
      console.log('[Team] Problèmes : ' + reviewResult.issues.join(', '));
      code = await fixCode(task, code, reviewResult.issues);
      reviewResult = await review(task, code, projectFiles);
      console.log('[Team] 📊 Review après correction : ' + reviewResult.score + '/10');
      fixPasses++;
    }

    // Si score trop bas après 2 passes → skipper
    if (reviewResult.score < 6) {
      await notify(
        '⚠️ *Tâche abandonnée : ' + task.title + '*\n' +
        'Score qualité trop bas après ' + fixPasses + ' corrections (' + reviewResult.score + '/10).\n' +
        'Problèmes persistants : ' + reviewResult.issues.join(', ')
      );
      return;
    }

    // 7. Écrire le fichier
    const targetFile = task.outputFile || (task.filesToModify && task.filesToModify[0]);
    if (!targetFile) {
      console.log('[Team] ⚠️ Aucun fichier cible défini, skip.');
      return;
    }
    writeFile(targetFile, code);

    // 8. Build check
    const build = buildCheck();
    if (!build.ok) {
      console.log('[Team] ❌ Build échoué, tentative de correction automatique...');

      // Donner l'erreur à GPT pour correction rapide
      const buildFix = await gpt(
        'Tu es un expert debug React. Corrige le code pour que le build Vite réussisse. Retourne UNIQUEMENT le code corrigé complet, sans markdown.',
        'ERREUR DE BUILD :\n' + build.error.substring(0, 1500) +
        '\n\nCODE ACTUEL :\n' + code
      );
      writeFile(targetFile, buildFix);

      const rebuild = buildCheck();
      if (!rebuild.ok) {
        // Restaurer le backup
        const backupPath = path.join(PROJECT_ROOT, targetFile + '.bak');
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, path.join(PROJECT_ROOT, targetFile));
          console.log('[Team] ↩️ Backup restauré.');
        }
        await notifyError(
          'Build échoué même après correction pour "' + task.title + '".\n' +
          'Fichier restauré depuis le backup.'
        );
        return;
      }
    }

    // 9. Push uniquement si tout est vert
    saveDone(task.title);
    await commitAndPush('feat: ' + task.title + ' [score: ' + reviewResult.score + '/10]', ['.']);

    await notify(
      '✅ *Cycle #' + cycleNum + ' terminé avec succès !*\n\n' +
      '📦 Tâche : *' + task.title + '*\n' +
      '⭐ Score qualité : ' + reviewResult.score + '/10\n' +
      '📝 ' + reviewResult.summary + '\n\n' +
      '_Prochain cycle dans ' + (CYCLE_INTERVAL_MS / 60000) + ' minutes_'
    );

    console.log('\n[Team] ✅ Cycle #' + cycleNum + ' terminé — ' + task.title);

  } catch (err) {
    console.error('[Team] ❌ Erreur cycle #' + cycleNum + ' :', err.message);
    await notifyError('Erreur cycle #' + cycleNum + ' : ' + err.message);
  }
}

// ─── Démarrage ────────────────────────────────────────────
async function start() {
  console.log('🤖 BudgetQuest — Équipe Intelligente');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Processus : Brainstorm → Plan → Implement → Review → Fix → Build → Push');
  console.log('Intervalle : ' + (CYCLE_INTERVAL_MS / 60000) + ' minutes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await notify(
    '🚀 *Équipe Intelligente BudgetQuest activée*\n\n' +
    'Les agents vont maintenant :\n' +
    '• Brainstormer ensemble\n' +
    '• Sélectionner la meilleure tâche\n' +
    '• Implémenter avec contexte complet\n' +
    '• Se reviewer mutuellement\n' +
    '• Vérifier le build avant de pusher\n\n' +
    'Une tâche bien faite toutes les ' + (CYCLE_INTERVAL_MS / 60000) + ' min.\n\n' +
    'Commandes : /status /debug /help'
  );

  let cycleNum = 1;

  // Premier cycle immédiat
  await runSmartCycle(cycleNum++);

  // Boucle
  setInterval(async () => {
    await runSmartCycle(cycleNum++);
  }, CYCLE_INTERVAL_MS);

  // Telegram
  const { bot } = require('./telegram');
  const { runDebugCycle } = require('./agents/debugAgent');
  const { getRepoStatus } = require('./agents/devopsAgent');

  bot.on('message', async (msg) => {
    if (msg.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) return;
    const text = (msg.text || '').trim();
    const chatId = msg.chat.id.toString();

    if (text === '/status') {
      const s = await getRepoStatus();
      await bot.sendMessage(chatId,
        '📊 *Status*\n\nDerniers commits :\n' + s.recentCommits.map(c => '• ' + c.message).join('\n'),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (text === '/debug') {
      await bot.sendMessage(chatId, '🔍 Debug en cours...');
      const r = await runDebugCycle();
      if (!r.hasErrors) await bot.sendMessage(chatId, '✅ Build OK, aucune erreur.');
      else if (r.fixed > 0) {
        await commitAndPush('fix: auto-debug', ['.']);
        await bot.sendMessage(chatId, '🔧 ' + r.fixed + ' erreur(s) corrigée(s) et pushée(s).');
      } else await bot.sendMessage(chatId, '⚠️ Erreurs persistantes, vérification manuelle nécessaire.');
      return;
    }

    if (text === '/help') {
      await bot.sendMessage(chatId,
        '🎮 *BudgetQuest — Équipe Intelligente*\n\n' +
        '/status — Derniers commits\n' +
        '/debug  — Corriger les erreurs frontend\n' +
        '/help   — Aide\n\n' +
        'Ou envoie une directive libre, ex:\n' +
        '"Ajoute une page de profil utilisateur"',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (text.startsWith('/')) return;

    // Directive libre — passe par le même processus intelligent
    await notify('📌 *Directive reçue :* ' + text + '\n\nDébut du processus intelligent...');
    const projectFiles = scanProject();

    // Plan direct sur la directive
    const task = JSON.parse(await gpt(
      'Tu es le chef de projet BudgetQuest. Une directive humaine arrive. Crée un plan détaillé. Réponds en json.',
      'DIRECTIVE : ' + text +
      '\n\nFICHIERS EXISTANTS :\n' + Object.keys(projectFiles).join('\n') +
      '\n\nRetourne ce json :\n{"agent":"frontend"|"backend","title":"...","why":"...","outputFile":"frontend/src/.../fichier.jsx ou null","filesToModify":[],"spec":"description technique très détaillée","risks":"...","doneCheck":"..."}',
      true
    ));

    let code = await implement(task, projectFiles);
    let rev = await review(task, code, projectFiles);

    let fixes = 0;
    while (!rev.approved && fixes < 2) {
      code = await fixCode(task, code, rev.issues);
      rev = await review(task, code, projectFiles);
      fixes++;
    }

    const target = task.outputFile || (task.filesToModify && task.filesToModify[0]);
    if (target) {
      writeFile(target, code);
      const build = buildCheck();
      if (build.ok) {
        saveDone(task.title);
        await commitAndPush('feat: ' + task.title + ' (directive) [' + rev.score + '/10]', ['.']);
        await notify('✅ *Directive exécutée :* ' + task.title + '\n⭐ Score : ' + rev.score + '/10');
      } else {
        const backupPath = path.join(PROJECT_ROOT, target + '.bak');
        if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, path.join(PROJECT_ROOT, target));
        await notifyError('Build échoué pour "' + task.title + '". Backup restauré.');
      }
    }
  });
}

start().catch(async err => {
  console.error('Erreur fatale :', err);
  await notifyError('Erreur fatale : ' + err.message);
  process.exit(1);
});
