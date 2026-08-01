/**
 * BudgetQuest - Equipe intelligente d'agents
 *
 * Processus par cycle :
 *  1. SCAN       - Lire tout le code + contexte projet
 *  2. BRAINSTORM - 3 agents debattent et proposent des idees
 *  3. PLAN       - Chef de projet selectionne UNE tache avec spec detaillee
 *  4. IMPLEMENT  - Agent implemente avec contexte complet
 *  5. REVIEW     - Reviewer critique le code produit (score 0-10)
 *  6. FIX        - Correction si score < 8 (max 2 passes)
 *  7. BUILD      - Vite build obligatoire
 *  8. PUSH       - Commit seulement si build vert
 *
 * Une seule tache bien faite toutes les 15 minutes.
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
const CYCLE_INTERVAL_MS = 15 * 60 * 1000;

// ─── Memoire ─────────────────────────────────────────────
function loadDone() {
  if (!fs.existsSync(DONE_FILE)) return [];
  return JSON.parse(fs.readFileSync(DONE_FILE, 'utf-8'));
}
function saveDone(task) {
  const done = loadDone();
  done.push({ task, at: new Date().toISOString() });
  fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
}

// ─── Contexte projet ──────────────────────────────────────
function loadProjectContext() {
  const p = path.join(__dirname, 'PROJECT_CONTEXT.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

// ─── Scanner le projet ────────────────────────────────────
function scanProject() {
  const files = {};
  const dirs = [
    'frontend/src/pages', 'frontend/src/components',
    'frontend/src/store', 'frontend/src/lib',
    'backend/src/routes', 'backend/src',
  ];
  for (const dir of dirs) {
    const full = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(full)) continue;
    fs.readdirSync(full).forEach(f => {
      if (!f.match(/\.(js|jsx)$/)) return;
      const rel = dir + '/' + f;
      files[rel] = fs.readFileSync(path.join(full, f), 'utf-8');
    });
  }
  return files;
}

// ─── Appel GPT ────────────────────────────────────────────
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
  for (let i = 0; i < 3; i++) {
    try {
      const res = await openai.chat.completions.create(opts);
      return res.choices[0].message.content;
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// ─── ETAPE 1 : BRAINSTORM ─────────────────────────────────
async function brainstorm(projectFiles, doneTasks, context) {
  console.log('\n[Team] Etape 1/6 - Brainstorm...');

  const fileList = Object.keys(projectFiles).join('\n');
  const doneList = doneTasks.slice(-15).map(t => '- ' + t.task).join('\n') || 'Aucune';

  const baseContext = 'CONTEXTE PROJET COMPLET :\n' + context +
    '\n\nFICHIERS EXISTANTS :\n' + fileList +
    '\n\nTACHES DEJA FAITES (ne pas repeter) :\n' + doneList;

  const frontendIdeas = await gpt(
    'Tu es un developpeur frontend senior React/TailwindCSS expert sur BudgetQuest. ' +
    'Tu connais les regles du projet et tu proposes uniquement des ameliorations realisables ' +
    'avec les librairies installees. Tu preferes creer de nouveaux fichiers plutot que modifier lexistant.',
    baseContext + '\n\nPropose 3 ameliorations frontend. Pour chacune : titre, impact utilisateur, ' +
    'complexite (faible/moyenne/haute), fichier cible (nouveau ou existant), risque.'
  );

  const backendIdeas = await gpt(
    'Tu es un developpeur backend senior Node.js/Express/Supabase expert sur BudgetQuest. ' +
    'Tu connais les regles du projet et tu proposes uniquement des ameliorations realisables.',
    baseContext + '\n\nPropose 3 ameliorations backend. Pour chacune : titre, impact, complexite, fichier cible, risque.'
  );

  const uxCritique = await gpt(
    'Tu es un expert UX et qualite logicielle. Tu analyses les propositions avec un oeil critique ' +
    'et tu identifies les risques (imports fantomes, librairies manquantes, regressions potentielles).',
    'PROPOSITIONS FRONTEND :\n' + frontendIdeas +
    '\n\nPROPOSITIONS BACKEND :\n' + backendIdeas +
    '\n\nCONTEXTE PROJET :\n' + context.substring(0, 1500) +
    '\n\nAnalyse critique : quelles 2 propositions sont les plus sures et les plus impactantes ? ' +
    'Quelles sont les plus risquees et pourquoi ?'
  );

  return { frontendIdeas, backendIdeas, uxCritique };
}

// ─── ETAPE 2 : PLAN ───────────────────────────────────────
async function plan(brainstormResult, projectFiles, context) {
  console.log('[Team] Etape 2/6 - Planification...');

  const filesSample = Object.entries(projectFiles)
    .slice(0, 8)
    .map(([f, c]) => '=== ' + f + ' ===\n' + c.substring(0, 400))
    .join('\n\n');

  const result = await gpt(
    'Tu es le chef de projet BudgetQuest. Tu selectionnes UNE seule tache ce cycle. ' +
    'Tu privilegies toujours les taches a faible risque (nouveau fichier > modification). ' +
    'Tu refuses toute tache qui utiliserait des librairies non installees. Reponds en json.',
    'BRAINSTORM :\nFrontend : ' + brainstormResult.frontendIdeas.substring(0, 600) +
    '\nBackend : ' + brainstormResult.backendIdeas.substring(0, 600) +
    '\nCritique UX : ' + brainstormResult.uxCritique.substring(0, 400) +
    '\n\nCONTEXTE PROJET :\n' + context.substring(0, 2000) +
    '\n\nEXTRAITS CODE :\n' + filesSample.substring(0, 2000) +
    '\n\nRetourne ce json exact :\n' +
    '{"agent":"frontend ou backend",' +
    '"title":"titre court",' +
    '"why":"pourquoi cette tache maintenant en 1 phrase",' +
    '"outputFile":"frontend/src/components/NouveauFichier.jsx ou null si modification",' +
    '"filesToModify":["liste fichiers existants a modifier, vide si nouveau fichier"],' +
    '"spec":"description technique tres detaillee, ligne par ligne",' +
    '"risks":"risques identifies",' +
    '"doneCheck":"comment verifier que cest bien fait"}',
    true
  );

  return JSON.parse(result);
}

// ─── ETAPE 3 : IMPLEMENT ──────────────────────────────────
async function implement(task, projectFiles, context) {
  console.log('[Team] Etape 3/6 - Implementation agent ' + task.agent + '...');

  const allKeys = Object.keys(projectFiles);

  // Charger les fichiers pertinents complets
  const relevant = {};
  (task.filesToModify || []).forEach(f => {
    const key = allKeys.find(k => k.includes(f.split('/').pop().replace('.jsx', '').replace('.js', '')));
    if (key) relevant[key] = projectFiles[key];
  });

  if (task.agent === 'frontend') {
    ['App.jsx', 'index.css', 'api.js', 'authStore.js', 'Layout.jsx'].forEach(name => {
      const key = allKeys.find(k => k.endsWith(name));
      if (key && !relevant[key]) relevant[key] = projectFiles[key];
    });
  } else {
    ['index.js', 'supabase.js', 'auth.js'].forEach(name => {
      const key = allKeys.find(k => k.endsWith(name));
      if (key && !relevant[key]) relevant[key] = projectFiles[key];
    });
  }

  const contextStr = Object.entries(relevant)
    .map(([f, c]) => '=== ' + f + ' (complet) ===\n' + c)
    .join('\n\n');

  const rules = task.agent === 'frontend'
    ? 'REGLES ABSOLUES :\n' +
      '1. Retourne UNIQUEMENT du code source pur. PAS de markdown. PAS de backticks.\n' +
      '2. Le code commence directement par "import" ou "const" ou "export".\n' +
      '3. Un seul composant par fichier.\n' +
      '4. Utilise UNIQUEMENT les librairies listees dans le contexte projet.\n' +
      '5. Nimporte pas de fichiers qui nexistent pas (verifie la liste des fichiers existants).\n' +
      '6. Utilise uniquement les classes CSS : card, btn-primary, btn-secondary, input, badge, et classes Tailwind standard.'
    : 'REGLES ABSOLUES :\n' +
      '1. Retourne UNIQUEMENT du code source pur. PAS de markdown. PAS de backticks.\n' +
      '2. Le code commence par "require(" ou "const" ou "module.exports".\n' +
      '3. Valide toutes les entrees utilisateur.\n' +
      '4. Utilise UNIQUEMENT les librairies installees listees dans le contexte.';

  return await gpt(
    'Tu es un developpeur ' + task.agent + ' expert.\n' + rules,
    'SPEC DE LA TACHE :\n' + task.spec +
    '\n\nRISQUES A EVITER :\n' + task.risks +
    '\n\nFICHIERS DU PROJET DISPONIBLES (pour les imports) :\n' + allKeys.join('\n') +
    '\n\nCODE DES FICHIERS CONCERNES :\n' + contextStr.substring(0, 4000)
  );
}

// ─── ETAPE 4 : REVIEW ─────────────────────────────────────
async function review(task, code, projectFiles) {
  console.log('[Team] Etape 4/6 - Review qualite...');

  const result = await gpt(
    'Tu es un reviewer de code senior specialise React/Node.js. ' +
    'Tu verifies la qualite, la coherence, les imports, et les bugs potentiels. Reponds en json.',
    'SPEC DEMANDEE :\n' + task.spec +
    '\n\nFICHIERS EXISTANTS (pour verifier les imports) :\n' + Object.keys(projectFiles).join('\n') +
    '\n\nCODE PRODUIT :\n' + code +
    '\n\nVerifie : imports valides, pas de librairies manquantes, pas de fichiers fantomes, ' +
    'coherence avec le projet, qualite du code.\n' +
    'Retourne ce json :\n' +
    '{"approved":true ou false,' +
    '"score":0 a 10,' +
    '"issues":["liste des problemes"],' +
    '"fixes":["corrections suggerees"],' +
    '"summary":"resume en 1 phrase"}',
    true
  );

  return JSON.parse(result);
}

// ─── ETAPE 5 : FIX ────────────────────────────────────────
async function fixCode(task, code, reviewResult) {
  console.log('[Team] Etape 5/6 - Correction (issues: ' + reviewResult.issues.length + ')...');

  return await gpt(
    'Tu es un developpeur expert qui corrige du code suite a une review. ' +
    'REGLES : Retourne UNIQUEMENT le code corrige complet. PAS de markdown. PAS de backticks. ' +
    'Corrige EXACTEMENT les problemes listes, ne change rien dautre.',
    'CODE A CORRIGER :\n' + code +
    '\n\nPROBLEMES :\n' + reviewResult.issues.join('\n') +
    '\n\nCORRECTIONS SUGGEREES :\n' + reviewResult.fixes.join('\n')
  );
}

// ─── ETAPE 6 : BUILD ──────────────────────────────────────
function buildFrontend() {
  console.log('[Team] Etape 6/6 - Build Vite...');
  try {
    execSync('npm run build', {
      cwd: path.join(PROJECT_ROOT, 'frontend'),
      stdio: 'pipe',
      timeout: 90000,
    });
    return { ok: true };
  } catch (err) {
    const out = (err.stdout || '').toString() + '\n' + (err.stderr || '').toString();
    return { ok: false, error: out };
  }
}

// ─── Ecriture fichier ─────────────────────────────────────
function writeFile(relPath, content) {
  const fullPath = path.join(PROJECT_ROOT, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  let clean = content.trim();
  const block = clean.match(/```(?:jsx?|tsx?|js|ts)?\n?([\s\S]*?)```/);
  if (block) clean = block[1].trim();

  const lines = clean.split('\n');
  const start = lines.findIndex(l =>
    l.startsWith('import ') || l.startsWith('const ') ||
    l.startsWith('export ') || l.startsWith('function ') || l.startsWith('require(')
  );
  if (start > 0) clean = lines.slice(start).join('\n').trim();

  // Backup si fichier existant
  if (fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath + '.bak', fs.readFileSync(fullPath));
  }

  fs.writeFileSync(fullPath, clean, 'utf-8');
  console.log('[Team] Fichier ecrit : ' + relPath);
}

// ─── CYCLE COMPLET ────────────────────────────────────────
async function runCycle(cycleNum) {
  console.log('\n' + '='.repeat(55));
  console.log('[Team] Cycle #' + cycleNum + ' - ' + new Date().toLocaleTimeString());
  console.log('='.repeat(55));

  try {
    const projectFiles = scanProject();
    const doneTasks = loadDone();
    const context = loadProjectContext();
    console.log('[Team] ' + Object.keys(projectFiles).length + ' fichiers, ' + doneTasks.length + ' taches passees.');

    // 1. Brainstorm
    const bs = await brainstorm(projectFiles, doneTasks, context);
    await notify(
      '🧠 *Cycle #' + cycleNum + ' — Brainstorm*\n\n' +
      bs.uxCritique.substring(0, 400) + '...'
    );

    // 2. Plan
    const task = await plan(bs, projectFiles, context);
    console.log('[Team] Tache : ' + task.title);
    await notify(
      '📋 *Tache selectionnee :* ' + task.title + '\n' +
      '_' + task.why + '_\n' +
      '⚠️ Risques : ' + task.risks
    );

    // 3. Implement
    let code = await implement(task, projectFiles, context);

    // 4. Review
    let rev = await review(task, code, projectFiles);
    console.log('[Team] Review : ' + rev.score + '/10 - ' + rev.summary);

    // 5. Fix si necessaire (max 2 passes)
    let passes = 0;
    while (rev.score < 8 && passes < 2) {
      console.log('[Team] Score insuffisant (' + rev.score + '/10), correction pass ' + (passes + 1) + '...');
      code = await fixCode(task, code, rev);
      rev = await review(task, code, projectFiles);
      console.log('[Team] Apres correction : ' + rev.score + '/10');
      passes++;
    }

    // Abandonner si qualite trop basse
    if (rev.score < 6) {
      await notify('⚠️ Tache abandonnee : *' + task.title + '* (score ' + rev.score + '/10 apres ' + passes + ' corrections)');
      return;
    }

    // 6. Ecrire le fichier
    const target = task.outputFile || (task.filesToModify && task.filesToModify[0]);
    if (!target) {
      console.log('[Team] Aucun fichier cible, skip.');
      return;
    }
    writeFile(target, code);

    // 7. Build check
    const build = buildFrontend();
    if (!build.ok) {
      console.log('[Team] Build KO, tentative correction auto...');
      const fixedCode = await gpt(
        'Tu es un expert debug React/Vite. Corrige le code pour que le build reussisse. ' +
        'Retourne UNIQUEMENT le code corrige, sans markdown, sans backticks.',
        'ERREUR BUILD :\n' + build.error.substring(0, 2000) + '\n\nCODE ACTUEL :\n' + code
      );
      writeFile(target, fixedCode);

      const rebuild = buildFrontend();
      if (!rebuild.ok) {
        // Restaurer backup
        const bak = path.join(PROJECT_ROOT, target + '.bak');
        if (fs.existsSync(bak)) {
          fs.copyFileSync(bak, path.join(PROJECT_ROOT, target));
          console.log('[Team] Backup restaure.');
        }
        await notifyError('Build echoue pour "' + task.title + '". Fichier restaure.');
        return;
      }
    }

    // Nettoyer les backups apres succes
    const bakPath = path.join(PROJECT_ROOT, target + '.bak');
    if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);

    // 8. Push
    saveDone(task.title);
    await commitAndPush('feat: ' + task.title + ' [' + rev.score + '/10]', ['.']);
    await notify(
      '✅ *Cycle #' + cycleNum + ' termine !*\n\n' +
      '📦 *' + task.title + '*\n' +
      '⭐ Score : ' + rev.score + '/10\n' +
      '📝 ' + rev.summary + '\n\n' +
      '_Prochain cycle dans ' + (CYCLE_INTERVAL_MS / 60000) + ' min_'
    );

  } catch (err) {
    console.error('[Team] Erreur cycle #' + cycleNum + ' :', err.message);
    await notifyError('Erreur cycle #' + cycleNum + ' : ' + err.message);
  }
}

// ─── Demarrage ────────────────────────────────────────────
async function start() {
  console.log('BudgetQuest - Equipe Intelligente');
  console.log('Brainstorm -> Plan -> Implement -> Review -> Fix -> Build -> Push');
  console.log('Intervalle : ' + (CYCLE_INTERVAL_MS / 60000) + ' min\n');

  await notify(
    '🚀 *Equipe Intelligente activee*\n\n' +
    'Processus par cycle :\n' +
    '• Brainstorm (3 agents)\n' +
    '• Selection de la meilleure tache\n' +
    '• Implementation avec contexte complet\n' +
    '• Review qualite (score /10)\n' +
    '• Build Vite obligatoire\n' +
    '• Push seulement si tout est vert\n\n' +
    '1 tache par cycle, toutes les ' + (CYCLE_INTERVAL_MS / 60000) + ' min.\n\n' +
    'Commandes : /status /debug /help'
  );

  let n = 1;
  await runCycle(n++);
  setInterval(() => runCycle(n++), CYCLE_INTERVAL_MS);

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
      await bot.sendMessage(chatId, '📊 *Status*\n\n' + s.recentCommits.map(c => '• ' + c.message).join('\n'), { parse_mode: 'Markdown' });
      return;
    }
    if (text === '/debug') {
      await bot.sendMessage(chatId, '🔍 Debug en cours...');
      const r = await runDebugCycle();
      if (!r.hasErrors) await bot.sendMessage(chatId, '✅ Build OK.');
      else if (r.fixed > 0) { await commitAndPush('fix: auto-debug', ['frontend']); await bot.sendMessage(chatId, '🔧 ' + r.fixed + ' erreur(s) corrigee(s).'); }
      else await bot.sendMessage(chatId, '⚠️ Erreurs persistantes.');
      return;
    }
    if (text === '/help') {
      await bot.sendMessage(chatId, '🎮 *BudgetQuest*\n\n/status - Commits\n/debug - Fix erreurs\n/help - Aide\n\nOu envoie une directive libre.', { parse_mode: 'Markdown' });
      return;
    }
    if (text.startsWith('/')) return;

    // Directive libre
    await notify('📌 *Directive :* ' + text);
    const pf = scanProject();
    const ctx = loadProjectContext();

    const task = JSON.parse(await gpt(
      'Tu es le chef de projet BudgetQuest. Cree un plan pour cette directive. Reponds en json.',
      'DIRECTIVE : ' + text +
      '\n\nCONTEXTE :\n' + ctx.substring(0, 2000) +
      '\n\nFICHIERS :\n' + Object.keys(pf).join('\n') +
      '\n\nJson : {"agent":"frontend ou backend","title":"...","why":"...","outputFile":"frontend/src/.../Fichier.jsx ou null","filesToModify":[],"spec":"spec detaillee","risks":"...","doneCheck":"..."}',
      true
    ));

    let code = await implement(task, pf, ctx);
    let rev = await review(task, code, pf);
    let p = 0;
    while (rev.score < 8 && p < 2) { code = await fixCode(task, code, rev); rev = await review(task, code, pf); p++; }

    const target = task.outputFile || (task.filesToModify && task.filesToModify[0]);
    if (target) {
      writeFile(target, code);
      const build = buildFrontend();
      if (build.ok) {
        saveDone(task.title);
        await commitAndPush('feat: ' + task.title + ' (directive) [' + rev.score + '/10]', ['.']);
        await notify('✅ *Directive executee :* ' + task.title + ' [' + rev.score + '/10]');
      } else {
        const bak = path.join(PROJECT_ROOT, target + '.bak');
        if (fs.existsSync(bak)) fs.copyFileSync(bak, path.join(PROJECT_ROOT, target));
        await notifyError('Build echoue pour directive "' + task.title + '". Backup restaure.');
      }
    }
  });
}

start().catch(async err => {
  console.error('Erreur :', err);
  await notifyError('Erreur fatale : ' + err.message);
  process.exit(1);
});
