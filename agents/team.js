/**
 * BudgetQuest - Equipe intelligente d'agents
 *
 * Processus par cycle :
 *  1. SCAN       - Lire code + contexte + roadmap
 *  2. BRAINSTORM - 3 agents proposent selon la priorite actuelle
 *  3. PLAN       - Chef de projet selectionne UNE tache (must have > should have > nice to have)
 *  4. IMPLEMENT  - Agent implemente avec contexte complet
 *  5. REVIEW     - Reviewer critique (score 0-10)
 *  6. FIX        - Correction si score < 8 (max 2 passes)
 *  7. BUILD      - Vite build obligatoire
 *  8. PUSH       - Commit seulement si build vert + mise a jour roadmap
 */

require('dotenv').config({ path: '../.env' });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { notify, notifyError } = require('./telegram');
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
function saveDone(taskTitle) {
  const done = loadDone();
  done.push({ task: taskTitle, at: new Date().toISOString() });
  fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
}

// ─── Fichiers de contexte ─────────────────────────────────
function loadContext() {
  const ctxPath = path.join(__dirname, 'PROJECT_CONTEXT.md');
  return fs.existsSync(ctxPath) ? fs.readFileSync(ctxPath, 'utf-8') : '';
}

function loadRoadmap() {
  const rmPath = path.join(__dirname, 'ROADMAP.md');
  return fs.existsSync(rmPath) ? fs.readFileSync(rmPath, 'utf-8') : '';
}

function saveRoadmap(content) {
  fs.writeFileSync(path.join(__dirname, 'ROADMAP.md'), content, 'utf-8');
}

// ─── Analyser la priorite actuelle depuis la roadmap ──────
function getCurrentPriority(roadmap) {
  const mustSection = roadmap.split('## 🟡')[0];
  const shouldSection = (roadmap.split('## 🟡')[1] || '').split('## 🟢')[0];

  const mustRemaining = (mustSection.match(/- \[ \]/g) || []).length;
  const shouldRemaining = (shouldSection.match(/- \[ \]/g) || []).length;

  if (mustRemaining > 0) {
    return {
      level: 'MUST HAVE',
      emoji: '🔴',
      remaining: mustRemaining,
      instruction: 'Il reste ' + mustRemaining + ' MUST HAVE. Les agents se concentrent UNIQUEMENT sur les fonctionnalites core. Les effets CSS, animations, polish sont INTERDITS.',
    };
  }
  if (shouldRemaining > 0) {
    return {
      level: 'SHOULD HAVE',
      emoji: '🟡',
      remaining: shouldRemaining,
      instruction: 'Tous les MUST HAVE sont faits. Il reste ' + shouldRemaining + ' SHOULD HAVE. Les agents travaillent sur ces fonctionnalites importantes. Les animations sont encore interdites.',
    };
  }
  return {
    level: 'NICE TO HAVE',
    emoji: '🟢',
    remaining: 0,
    instruction: 'Tous les MUST HAVE et SHOULD HAVE sont implementes. Les agents peuvent travailler sur le polish et les animations.',
  };
}

// ─── Taches restantes de la roadmap ──────────────────────
function getRemainingTasks(roadmap) {
  return (roadmap.match(/- \[ \] .+/g) || []).map(t => t.replace('- [ ] ', '')).slice(0, 12);
}

// ─── Cocher une tache dans la roadmap ────────────────────
function tickRoadmap(roadmap, taskTitle) {
  const normalized = taskTitle.toLowerCase();
  const lines = roadmap.split('\n');
  let ticked = false;

  const updated = lines.map(line => {
    if (ticked || !line.includes('- [ ]')) return line;
    const words = normalized.split(' ').filter(w => w.length > 4);
    const matches = words.filter(w => line.toLowerCase().includes(w)).length;
    if (matches >= Math.ceil(words.length * 0.5)) {
      ticked = true;
      return line.replace('- [ ]', '- [x]');
    }
    return line;
  });

  if (ticked) {
    saveRoadmap(updated.join('\n'));
    console.log('[Team] Roadmap: tache cochee pour "' + taskTitle + '"');
  }
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
      files[dir + '/' + f] = fs.readFileSync(path.join(full, f), 'utf-8');
    });
  }
  return files;
}

// ─── Appel GPT ────────────────────────────────────────────
async function gpt(system, user, json) {
  const opts = {
    model: 'gpt-4o',
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature: json ? 0.1 : 0.4,
    max_tokens: 4096,
  };
  if (json) opts.response_format = { type: 'json_object' };
  for (let i = 0; i < 3; i++) {
    try {
      return (await openai.chat.completions.create(opts)).choices[0].message.content;
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// ─── ETAPE 1 : BRAINSTORM ─────────────────────────────────
async function brainstorm(projectFiles, doneTasks, context, priority, remaining) {
  console.log('[Team] 1/6 Brainstorm (' + priority.emoji + ' ' + priority.level + ')...');

  const fileList = Object.keys(projectFiles).join('\n');
  const doneList = doneTasks.slice(-10).map(t => '- ' + t.task).join('\n') || 'Aucune';
  const remainingList = remaining.join('\n');

  const priorityBlock =
    'PRIORITE ACTUELLE : ' + priority.emoji + ' ' + priority.level + '\n' +
    priority.instruction + '\n\n' +
    'FONCTIONNALITES RESTANTES A IMPLEMENTER :\n' + remainingList;

  const base =
    priorityBlock + '\n\n' +
    'CONTEXTE PROJET :\n' + context.substring(0, 1500) + '\n\n' +
    'FICHIERS EXISTANTS :\n' + fileList + '\n\n' +
    'TACHES DEJA FAITES :\n' + doneList;

  const frontendIdeas = await gpt(
    'Tu es un developpeur frontend senior React/TailwindCSS sur BudgetQuest. ' +
    'Tu respectes STRICTEMENT la contrainte de priorite. ' +
    'Tu proposes uniquement des ameliorations realisables avec les librairies installees. ' +
    'Tu preferes creer de nouveaux fichiers plutot que modifier lexistant.',
    base + '\n\nPropose 3 ameliorations frontend en respectant la priorite. ' +
    'Pour chacune : titre, impact, complexite, fichier (nouveau ou existant), risque.'
  );

  const backendIdeas = await gpt(
    'Tu es un developpeur backend senior Node.js/Express sur BudgetQuest. ' +
    'Tu respectes STRICTEMENT la contrainte de priorite.',
    base + '\n\nPropose 3 ameliorations backend en respectant la priorite. ' +
    'Pour chacune : titre, impact, complexite, fichier, risque.'
  );

  const critique = await gpt(
    'Tu es expert UX et qualite logicielle sur BudgetQuest. ' +
    'Tu analyses les propositions avec un oeil critique sur les risques techniques et la valeur utilisateur. ' +
    'Tu rappelles la contrainte de priorite si une proposition la viole.',
    'PRIORITE : ' + priority.emoji + ' ' + priority.level + '\n' +
    'PROPOSALS FRONTEND :\n' + frontendIdeas + '\n\n' +
    'PROPOSALS BACKEND :\n' + backendIdeas + '\n\n' +
    'Quelles 2 propositions sont les plus sures et les plus alignees avec la priorite ? ' +
    'Lesquelles violent la contrainte de priorite ?'
  );

  return { frontendIdeas, backendIdeas, critique };
}

// ─── ETAPE 2 : PLAN ───────────────────────────────────────
async function plan(bs, projectFiles, context, priority, remaining) {
  console.log('[Team] 2/6 Planification...');

  const result = await gpt(
    'Tu es chef de projet BudgetQuest. Tu selectionnes UNE seule tache ce cycle. ' +
    'REGLE ABSOLUE : tu DOIS respecter la contrainte de priorite. ' +
    'Tu refuses les librairies non installees. Reponds en json.',
    'PRIORITE : ' + priority.emoji + ' ' + priority.level + '\n' +
    priority.instruction + '\n\n' +
    'FONCTIONNALITES A FAIRE :\n' + remaining.join('\n') + '\n\n' +
    'BRAINSTORM FRONTEND :\n' + bs.frontendIdeas.substring(0, 500) + '\n\n' +
    'BRAINSTORM BACKEND :\n' + bs.backendIdeas.substring(0, 500) + '\n\n' +
    'CRITIQUE UX :\n' + bs.critique.substring(0, 400) + '\n\n' +
    'CONTEXTE :\n' + context.substring(0, 1000) + '\n\n' +
    'FICHIERS EXISTANTS :\n' + Object.keys(projectFiles).join('\n') + '\n\n' +
    'Retourne ce json : ' +
    '{"agent":"frontend ou backend",' +
    '"title":"titre court",' +
    '"priority":"MUST HAVE ou SHOULD HAVE ou NICE TO HAVE",' +
    '"why":"pourquoi cette tache maintenant",' +
    '"outputFile":"frontend/src/components/Fichier.jsx ou null",' +
    '"filesToModify":["fichiers existants a modifier"],' +
    '"spec":"spec technique detaillee",' +
    '"risks":"risques",' +
    '"doneCheck":"comment verifier"}',
    true
  );
  return JSON.parse(result);
}

// ─── ETAPE 3 : IMPLEMENT ──────────────────────────────────
async function implement(task, projectFiles, context) {
  console.log('[Team] 3/6 Implementation (' + task.agent + ')...');

  const allKeys = Object.keys(projectFiles);
  const relevant = {};

  (task.filesToModify || []).forEach(f => {
    const base = f.split('/').pop();
    const key = allKeys.find(k => k.endsWith(base));
    if (key) relevant[key] = projectFiles[key];
  });

  const coreFiles = task.agent === 'frontend'
    ? ['App.jsx', 'index.css', 'api.js', 'authStore.js', 'Layout.jsx']
    : ['index.js', 'supabase.js', 'auth.js'];

  coreFiles.forEach(name => {
    const key = allKeys.find(k => k.endsWith(name));
    if (key && !relevant[key]) relevant[key] = projectFiles[key];
  });

  const contextStr = Object.entries(relevant)
    .map(([f, c]) => '=== ' + f + ' ===\n' + c)
    .join('\n\n');

  const rules = task.agent === 'frontend'
    ? 'REGLES : Code pur uniquement. Pas de markdown. Commence par "import". Un seul composant par fichier. Librairies installees uniquement. Pas dimports de fichiers inexistants.'
    : 'REGLES : Code pur uniquement. Pas de markdown. Commence par "require(". Valide les entrees. Librairies installees uniquement.';

  return await gpt(
    'Tu es developpeur ' + task.agent + ' expert sur BudgetQuest. ' + rules,
    'SPEC : ' + task.spec + '\n\n' +
    'RISQUES : ' + task.risks + '\n\n' +
    'FICHIERS DISPONIBLES : ' + allKeys.join(', ') + '\n\n' +
    'CODE CONTEXTE :\n' + contextStr.substring(0, 4000)
  );
}

// ─── ETAPE 4 : REVIEW ─────────────────────────────────────
async function review(task, code, projectFiles) {
  console.log('[Team] 4/6 Review...');
  const result = await gpt(
    'Tu es reviewer senior React/Node.js. Tu evalues le code de facon PRAGMATIQUE. ' +
    'Un score de 7-8/10 est la norme pour du bon code fonctionnel. ' +
    'Tu donnes 9-10 uniquement si le code est exceptionnel. ' +
    'Tu donnes moins de 5 uniquement si le code est vraiment casse (imports inexistants, erreurs de syntaxe graves, composants dupliques). ' +
    'Les imperfections mineures de style ou dorganisation ne font pas baisser le score en dessous de 6. ' +
    'Reponds en json.',
    'SPEC : ' + task.spec + '\n\n' +
    'FICHIERS EXISTANTS : ' + Object.keys(projectFiles).join(', ') + '\n\n' +
    'CODE :\n' + code + '\n\n' +
    'Verifie uniquement : (1) imports valides vers fichiers existants, (2) pas de librairies non installees, (3) syntaxe correcte, (4) logique coherente avec la spec. ' +
    'Json : {"approved":true,"score":0,"issues":[],"fixes":[],"summary":""}',
    true
  );
  return JSON.parse(result);
}

// ─── ETAPE 5 : FIX ────────────────────────────────────────
async function fixCode(code, rev) {
  console.log('[Team] 5/6 Fix (score ' + rev.score + '/10, ' + rev.issues.length + ' issues)...');
  return await gpt(
    'Tu es developpeur expert. Corrige le code. Code pur uniquement, pas de markdown.',
    'CODE :\n' + code + '\n\nPROBLEMES :\n' + rev.issues.join('\n') + '\n\nFIXES :\n' + rev.fixes.join('\n')
  );
}

// ─── ETAPE 6 : BUILD ──────────────────────────────────────
function buildFrontend() {
  console.log('[Team] 6/6 Build Vite...');
  try {
    execSync('npm run build', { cwd: path.join(PROJECT_ROOT, 'frontend'), stdio: 'pipe', timeout: 90000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err.stdout || '').toString() + (err.stderr || '').toString() };
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

  if (fs.existsSync(fullPath)) fs.writeFileSync(fullPath + '.bak', fs.readFileSync(fullPath));
  fs.writeFileSync(fullPath, clean, 'utf-8');
  console.log('[Team] Ecrit : ' + relPath);
}

// ─── CYCLE COMPLET ────────────────────────────────────────
async function runCycle(cycleNum) {
  console.log('\n' + '='.repeat(50));
  console.log('[Team] Cycle #' + cycleNum + ' - ' + new Date().toLocaleTimeString());
  console.log('='.repeat(50));

  try {
    const projectFiles = scanProject();
    const doneTasks = loadDone();
    const context = loadContext();
    const roadmap = loadRoadmap();
    const priority = getCurrentPriority(roadmap);
    const remaining = getRemainingTasks(roadmap);

    console.log('[Team] Priorite : ' + priority.emoji + ' ' + priority.level + ' (' + priority.remaining + ' restantes)');
    console.log('[Team] ' + Object.keys(projectFiles).length + ' fichiers scannes.');

    // 1. Brainstorm
    const bs = await brainstorm(projectFiles, doneTasks, context, priority, remaining);
    await notify(
      '🧠 *Cycle #' + cycleNum + '* — ' + priority.emoji + ' ' + priority.level + '\n\n' +
      bs.critique.substring(0, 350) + '...'
    );

    // 2. Plan
    const task = await plan(bs, projectFiles, context, priority, remaining);
    console.log('[Team] Tache : [' + task.priority + '] ' + task.title);
    await notify(
      '📋 *' + task.title + '*\n' +
      task.priority + ' — ' + task.why + '\n' +
      '⚠️ ' + task.risks
    );

    // 3. Implement
    let code = await implement(task, projectFiles, context);

    // 4. Review
    let rev = await review(task, code, projectFiles);
    console.log('[Team] Review : ' + rev.score + '/10');

    // 5. Fix si necessaire (seuil 6/10, max 2 passes)
    let passes = 0;
    while (rev.score < 6 && passes < 2) {
      code = await fixCode(code, rev);
      rev = await review(task, code, projectFiles);
      console.log('[Team] Apres fix : ' + rev.score + '/10');
      passes++;
    }

    // Abandonner seulement si vraiment catastrophique (< 4/10 apres corrections)
    if (rev.score < 4) {
      await notify('⚠️ Tache abandonnee : *' + task.title + '* (score ' + rev.score + '/10 apres ' + passes + ' corrections)');
      return;
    }

    // 6. Ecrire le fichier
    const target = task.outputFile || (task.filesToModify && task.filesToModify[0]);
    if (!target) { console.log('[Team] Pas de fichier cible.'); return; }
    writeFile(target, code);

    // 7. Build
    const build = buildFrontend();
    if (!build.ok) {
      console.log('[Team] Build KO, correction auto...');
      const fixed = await gpt(
        'Expert debug React/Vite. Corrige le code. Code pur, pas de markdown.',
        'ERREUR :\n' + build.error.substring(0, 2000) + '\n\nCODE :\n' + code
      );
      writeFile(target, fixed);
      const rebuild = buildFrontend();
      if (!rebuild.ok) {
        const bak = path.join(PROJECT_ROOT, target + '.bak');
        if (fs.existsSync(bak)) fs.copyFileSync(bak, path.join(PROJECT_ROOT, target));
        await notifyError('Build echoue pour "' + task.title + '". Backup restaure.');
        return;
      }
    }

    // Nettoyer backup
    const bakPath = path.join(PROJECT_ROOT, target + '.bak');
    if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);

    // 8. Push + mise a jour roadmap
    saveDone(task.title);
    tickRoadmap(loadRoadmap(), task.title);
    await commitAndPush('feat(' + task.priority.replace(/ /g, '-').toLowerCase() + '): ' + task.title + ' [' + rev.score + '/10]', ['.']);

    await notify(
      '✅ *Cycle #' + cycleNum + ' termine*\n\n' +
      priority.emoji + ' ' + task.priority + '\n' +
      '📦 *' + task.title + '*\n' +
      '⭐ Score : ' + rev.score + '/10\n' +
      '📝 ' + rev.summary + '\n\n' +
      '_Prochain cycle dans ' + (CYCLE_INTERVAL_MS / 60000) + ' min_'
    );

  } catch (err) {
    console.error('[Team] Erreur cycle #' + cycleNum + ':', err.message);
    await notifyError('Erreur cycle #' + cycleNum + ' : ' + err.message);
  }
}

// ─── Demarrage ────────────────────────────────────────────
async function start() {
  console.log('BudgetQuest - Equipe Intelligente avec Roadmap');
  console.log('Must Have > Should Have > Nice to Have');
  console.log('Intervalle : ' + (CYCLE_INTERVAL_MS / 60000) + ' min\n');

  const roadmap = loadRoadmap();
  const priority = getCurrentPriority(roadmap);
  const remaining = getRemainingTasks(roadmap);

  await notify(
    '🚀 *Equipe BudgetQuest activee*\n\n' +
    'Priorite actuelle : ' + priority.emoji + ' *' + priority.level + '*\n' +
    priority.remaining + ' taches restantes\n\n' +
    'Prochaines a faire :\n' + remaining.slice(0, 4).map(t => '• ' + t).join('\n') + '\n\n' +
    'Processus : Brainstorm → Plan → Code → Review → Build → Push\n' +
    'Commandes : /status /debug /roadmap /help'
  );

  let n = 1;
  await runCycle(n++);
  setInterval(() => runCycle(n++), CYCLE_INTERVAL_MS);

  const { bot } = require('./telegram');
  const { runDebugCycle } = require('./agents/debugAgent');
  const { getRepoStatus } = require('./agents/devopsAgent');

  bot.on('message', async (msg) => {
    if (msg.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) return;
    const text = (msg.text || '').trim();
    const chatId = msg.chat.id.toString();

    if (text === '/status') {
      const s = await getRepoStatus();
      await bot.sendMessage(chatId, '📊 *Commits*\n\n' + s.recentCommits.map(c => '• ' + c.message).join('\n'), { parse_mode: 'Markdown' });
      return;
    }
    if (text === '/roadmap') {
      const rm = loadRoadmap();
      const pr = getCurrentPriority(rm);
      const rem = getRemainingTasks(rm);
      await bot.sendMessage(chatId,
        '📋 *Roadmap*\n\nPriorite : ' + pr.emoji + ' ' + pr.level + '\n\nA faire :\n' +
        rem.slice(0, 8).map(t => '• ' + t).join('\n'),
        { parse_mode: 'Markdown' }
      );
      return;
    }
    if (text === '/debug') {
      await bot.sendMessage(chatId, '🔍 Debug...');
      const r = await runDebugCycle();
      if (!r.hasErrors) await bot.sendMessage(chatId, '✅ Build OK.');
      else if (r.fixed > 0) { await commitAndPush('fix: auto-debug', ['frontend']); await bot.sendMessage(chatId, '🔧 ' + r.fixed + ' erreur(s) corrigee(s).'); }
      else await bot.sendMessage(chatId, '⚠️ Erreurs persistantes.');
      return;
    }
    if (text === '/help') {
      await bot.sendMessage(chatId,
        '🎮 *BudgetQuest*\n\n/roadmap - Voir la roadmap\n/status - Commits\n/debug - Fix erreurs\n/help - Aide\n\nOu envoie une directive libre.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    if (text.startsWith('/')) return;

    // Directive libre
    await notify('📌 *Directive :* ' + text);
    const pf = scanProject();
    const ctx = loadContext();
    const rm = loadRoadmap();
    const pr = getCurrentPriority(rm);
    const rem = getRemainingTasks(rm);

    const task = JSON.parse(await gpt(
      'Chef de projet BudgetQuest. Plan pour directive. Respecte la priorite. Reponds en json.',
      'PRIORITE : ' + pr.emoji + ' ' + pr.level + '\n' +
      'DIRECTIVE : ' + text + '\n' +
      'CONTEXTE :\n' + ctx.substring(0, 1500) + '\n' +
      'FICHIERS :\n' + Object.keys(pf).join('\n') + '\n' +
      'Json : {"agent":"frontend ou backend","title":"...","priority":"...","why":"...","outputFile":"... ou null","filesToModify":[],"spec":"...","risks":"...","doneCheck":"..."}',
      true
    ));

    let code = await implement(task, pf, ctx);
    let rev = await review(task, code, pf);
    let p = 0;
    while (rev.score < 6 && p < 2) { code = await fixCode(code, rev); rev = await review(task, code, pf); p++; }

    const target = task.outputFile || (task.filesToModify && task.filesToModify[0]);
    if (target) {
      writeFile(target, code);
      const build = buildFrontend();
      if (build.ok) {
        saveDone(task.title);
        tickRoadmap(loadRoadmap(), task.title);
        await commitAndPush('feat: ' + task.title + ' (directive) [' + rev.score + '/10]', ['.']);
        await notify('✅ *' + task.title + '* [' + rev.score + '/10]\n' + rev.summary);
      } else {
        const bak = path.join(PROJECT_ROOT, target + '.bak');
        if (fs.existsSync(bak)) fs.copyFileSync(bak, path.join(PROJECT_ROOT, target));
        await notifyError('Build echoue. Backup restaure.');
      }
    }
  });
}

start().catch(async err => {
  console.error('Erreur fatale:', err);
  await notifyError('Erreur fatale : ' + err.message);
  process.exit(1);
});
