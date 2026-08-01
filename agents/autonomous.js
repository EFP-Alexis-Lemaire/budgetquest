/**
 * BudgetQuest - Mode Autonome
 * 
 * Les agents analysent l'app, génèrent leurs propres tâches
 * et travaillent en boucle continue.
 * 
 * Ils ne posent des questions que si c'est vraiment bloquant.
 * 
 * Usage : node agents/autonomous.js
 */

require('dotenv').config({ path: '../.env' });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { notify, notifyError, askHuman } = require('./telegram');
const { runBackendAgent } = require('./agents/backendAgent');
const { runFrontendAgent } = require('./agents/frontendAgent');
const { commitAndPush } = require('./agents/devopsAgent');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PROJECT_ROOT = path.join(__dirname, '../');

// ─── Config ──────────────────────────────────────────────
const LOOP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes entre chaque cycle
const MAX_TASKS_PER_CYCLE = 2;           // Tâches max par cycle

// ─── Mémoire des tâches déjà faites ──────────────────────
const DONE_FILE = path.join(__dirname, '.done_tasks.json');

function loadDoneTasks() {
  if (!fs.existsSync(DONE_FILE)) return [];
  return JSON.parse(fs.readFileSync(DONE_FILE, 'utf-8'));
}

function saveDoneTask(task) {
  const done = loadDoneTasks();
  done.push({ task, done_at: new Date().toISOString() });
  fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
}

// ─── Scanner la structure du projet ──────────────────────
function scanProject() {
  const result = {};
  const dirs = ['frontend/src', 'backend/src'];

  for (const dir of dirs) {
    const fullDir = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;

    result[dir] = [];
    const scan = (d, depth = 0) => {
      if (depth > 3) return;
      fs.readdirSync(d).forEach(f => {
        const fp = path.join(d, f);
        const rel = fp.replace(PROJECT_ROOT, '').replace(/\\/g, '/');
        if (fs.statSync(fp).isDirectory()) {
          scan(fp, depth + 1);
        } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
          result[dir].push(rel);
        }
      });
    };
    scan(fullDir);
  }
  return result;
}

function readFilesSample() {
  // Lire quelques fichiers clés pour donner du contexte à l'IA
  const keyFiles = [
    'frontend/src/pages/DashboardPage.jsx',
    'frontend/src/App.jsx',
    'backend/src/routes/budgets.js',
    'backend/src/index.js',
  ];

  let content = '';
  for (const f of keyFiles) {
    const fp = path.join(PROJECT_ROOT, f);
    if (fs.existsSync(fp)) {
      const text = fs.readFileSync(fp, 'utf-8');
      content += `\n\n=== ${f} (${text.split('\n').length} lignes) ===\n${text.substring(0, 800)}...`;
    }
  }
  return content;
}

// ─── Générateur de tâches autonomes ──────────────────────
async function generateTasks() {
  const structure = scanProject();
  const sample = readFilesSample();
  const doneTasks = loadDoneTasks().map(t => t.task);

  const prompt = `Tu es le chef de projet de BudgetQuest, une app de gestion de budget gamifiée (style RPG).

Stack : React + Vite + TailwindCSS (frontend), ExpressJS + Supabase (backend).

Structure actuelle du projet :
${JSON.stringify(structure, null, 2)}

Aperçu du code existant :
${sample}

Tâches déjà effectuées (ne pas répéter) :
${doneTasks.slice(-20).map((t, i) => `${i + 1}. ${t}`).join('\n') || 'Aucune'}

Tu dois générer ${MAX_TASKS_PER_CYCLE} tâches d'amélioration CONCRÈTES et PRIORITAIRES pour l'app.

Critères de sélection :
- Impact utilisateur élevé (UX, fonctionnalités manquantes, bugs potentiels)
- Réalisable en une seule tâche par un agent IA (pas trop large)
- Améliore la gamification, le design, ou les fonctionnalités core
- Pas déjà dans la liste des tâches faites

Exemples de bonnes tâches :
- "Ajouter des animations CSS sur la barre XP quand elle progresse"
- "Créer un composant Toast pour les notifications (XP gagné, badges)"
- "Ajouter la validation des formulaires avec messages d'erreur inline"
- "Améliorer la page Analytics avec un graphique en camembert par catégorie"
- "Ajouter un mode sombre/clair toggle"
- "Créer une page 404 stylisée avec le thème RPG"

Réponds UNIQUEMENT en JSON :
{
  "tasks": [
    {
      "id": "unique_slug",
      "title": "Titre court",
      "description": "Description détaillée de ce que l'agent doit faire exactement",
      "agent": "frontend" | "backend",
      "priority": "high" | "medium",
      "outputFile": "chemin/du/fichier.jsx ou null si modification"
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content).tasks || [];
}

// ─── Décision : poser une question ou non ─────────────────
async function needsHumanInput(task) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Tu décides si une tâche de développement nécessite une validation humaine.
Réponds true UNIQUEMENT si :
- La tâche change l'architecture globale de l'app
- La tâche implique des données sensibles ou de la sécurité critique
- La tâche est fondamentalement ambiguë (plusieurs directions très différentes possibles)

Réponds false pour TOUT le reste (design, features, corrections, améliorations).
Réponds UNIQUEMENT en json : {"ask": true/false, "question": "..." }`
      },
      { role: 'user', content: `Tâche : ${task.description}` },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ─── Nettoyage du code généré ────────────────────────────
function extractCleanCode(content) {
  // 1. Extraire le premier bloc de code si présent
  const blockMatch = content.match(/```(?:jsx?|tsx?|javascript|typescript|js|ts)?\n([\s\S]*?)```/);
  if (blockMatch) return blockMatch[1].trim();

  // 2. Si pas de bloc mais contient du markdown (##, **, ---)
  // → chercher la partie qui ressemble à du vrai code JS/JSX
  const lines = content.split('\n');
  const codeStart = lines.findIndex(l =>
    l.startsWith('import ') ||
    l.startsWith('const ') ||
    l.startsWith('export ') ||
    l.startsWith('function ') ||
    l.startsWith('require(')
  );

  if (codeStart !== -1) {
    // Prendre tout à partir de la première ligne de code
    return lines.slice(codeStart).join('\n').trim();
  }

  // 3. Retourner tel quel si aucun markdown détecté
  return content.trim();
}

// ─── Validation syntaxique basique ───────────────────────
function validateCode(content, filePath) {
  const ext = path.extname(filePath);
  if (!['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return true;

  // Détecter du markdown résiduel
  const markdownSigns = ['### ', '## ', '** ', '- **', '* **', '---\n'];
  for (const sign of markdownSigns) {
    if (content.includes(sign)) {
      console.error(`[Autonomous] ❌ Markdown détecté dans le code : "${sign}"`);
      return false;
    }
  }

  // Détecter plusieurs composants/fichiers fusionnés
  const multipleExportDefaults = (content.match(/export default function/g) || []).length;
  if (multipleExportDefaults > 1) {
    console.error('[Autonomous] ❌ Plusieurs composants détectés dans un seul fichier');
    return false;
  }

  // Détecter un chemin de fichier commenté en milieu de code (signe de fusion)
  const midFileComment = content.match(/\n\/\/ (?:frontend|backend)\/src\//);
  if (midFileComment) {
    console.error('[Autonomous] ❌ Fusion de fichiers détectée dans le code');
    return false;
  }

  return true;
}

// ─── Écriture fichier ────────────────────────────────────
function writeFile(relativePath, content) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const clean = extractCleanCode(content);

  // Valider avant d'écrire
  if (!validateCode(clean, relativePath)) {
    throw new Error(`Code invalide (markdown résiduel) dans ${relativePath}. L'agent a retourné du texte au lieu de code pur.`);
  }

  // Backup de l'ancien fichier si existant
  if (fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath + '.bak', fs.readFileSync(fullPath), 'utf-8');
  }

  fs.writeFileSync(fullPath, clean, 'utf-8');
  console.log(`[Autonomous] ✅ Fichier écrit : ${relativePath}`);
}

// ─── Exécution d'une tâche ────────────────────────────────
async function executeTask(task) {
  console.log(`\n[Autonomous] ▶ Tâche : ${task.title}`);
  console.log(`[Autonomous]   Agent  : ${task.agent}`);

  // Vérifier si question humaine nécessaire
  const decision = await needsHumanInput(task);
  if (decision.ask) {
    console.log(`[Autonomous] ❓ Question envoyée sur Telegram...`);
    const answer = await askHuman(
      decision.question,
      `Tâche en cours : ${task.title}`
    );
    task.description += `\nPrécision de l'humain : ${answer}`;
  }

  // Exécuter via le bon agent
  let result;
  const contextFiles = task.agent === 'frontend'
    ? ['frontend/src/App.jsx', 'frontend/src/index.css', 'frontend/src/lib/api.js']
    : ['backend/src/index.js', 'backend/src/lib/supabase.js'];

  if (task.agent === 'frontend') {
    result = await runFrontendAgent(task.description, contextFiles);
  } else {
    result = await runBackendAgent(task.description, contextFiles);
  }

  // Écrire le fichier si spécifié
  if (task.outputFile && result) {
    writeFile(task.outputFile, result);
  }

  return result;
}

// ─── Boucle principale ────────────────────────────────────
async function runCycle(cycleNum) {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`[Autonomous] 🔄 Cycle #${cycleNum} démarré`);
  console.log(`${'═'.repeat(50)}`);

  try {
    // 1. Générer les tâches
    console.log('[Autonomous] 🧠 Génération des tâches...');
    const tasks = await generateTasks();

    if (tasks.length === 0) {
      console.log('[Autonomous] Aucune tâche générée ce cycle.');
      return;
    }

    // Notifier les tâches prévues
    const taskList = tasks.map((t, i) => `${i + 1}. [${t.agent.toUpperCase()}] ${t.title}`).join('\n');
    await notify(`🤖 *Cycle #${cycleNum} — ${tasks.length} tâches planifiées :*\n\n${taskList}`);

    // 2. Exécuter chaque tâche
    const completed = [];
    for (const task of tasks) {
      try {
        await executeTask(task);
        saveDoneTask(task.title);
        completed.push(task.title);
      } catch (err) {
        console.error(`[Autonomous] ❌ Erreur tâche "${task.title}": ${err.message}`);
        await notifyError(`Erreur sur "${task.title}": ${err.message}`);
      }
    }

    // 3. Commit et push si des fichiers ont été créés/modifiés
    if (completed.length > 0) {
      const commitMsg = `feat(autonomous): cycle #${cycleNum} - ${completed.join(', ').substring(0, 60)}`;
      await commitAndPush(commitMsg, ['.']);

      await notify(
        `✅ *Cycle #${cycleNum} terminé !*\n\n` +
        `Tâches complétées :\n${completed.map(t => `✓ ${t}`).join('\n')}\n\n` +
        `_Prochain cycle dans ${LOOP_INTERVAL_MS / 60000} minutes_`
      );
    }

  } catch (err) {
    console.error('[Autonomous] Erreur cycle :', err.message);
    await notifyError(`Erreur cycle #${cycleNum}: ${err.message}`);
  }
}

// ─── Démarrage ────────────────────────────────────────────
async function start() {
  console.log('🤖 BudgetQuest - Mode Autonome');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Interval : ${LOOP_INTERVAL_MS / 60000} minutes`);
  console.log(`Tâches/cycle : ${MAX_TASKS_PER_CYCLE}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await notify(
    `🚀 *Mode Autonome activé !*\n\n` +
    `Les agents vont maintenant travailler en autonomie.\n` +
    `• Cycle toutes les ${LOOP_INTERVAL_MS / 60000} minutes\n` +
    `• ${MAX_TASKS_PER_CYCLE} tâches par cycle\n` +
    `• Push automatique sur GitHub\n\n` +
    `Tu recevras un résumé après chaque cycle.\n` +
    `Réponds à ce message pour donner une directive prioritaire.`
  );

  let cycleNum = 1;

  // Premier cycle immédiat
  await runCycle(cycleNum++);

  // Boucle continue
  setInterval(async () => {
    await runCycle(cycleNum++);
  }, LOOP_INTERVAL_MS);

  // Écouter les directives prioritaires via Telegram
  const { bot } = require('./telegram');
  bot.on('message', async (msg) => {
    if (msg.chat.id.toString() !== process.env.TELEGRAM_CHAT_ID) return;
    const text = msg.text || '';
    if (text.startsWith('/')) return;

    // Directive prioritaire : l'injecter comme tâche immédiate
    console.log(`[Autonomous] 📱 Directive reçue : ${text}`);
    await notify(`📌 Directive prioritaire reçue, exécution immédiate...`);

    try {
      // Déterminer l'agent
      const routing = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Détermine l'agent pour cette tâche BudgetQuest.
Réponds en json : {"agent":"frontend"|"backend","title":"titre court","description":"description détaillée","outputFile":"chemin/fichier.jsx ou null"}`
          },
          { role: 'user', content: text },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const task = JSON.parse(routing.choices[0].message.content);
      await executeTask(task);
      saveDoneTask(task.title);
      await commitAndPush(`feat: ${task.title} (directive)`, ['.']);
      await notify(`✅ Directive exécutée : *${task.title}*`);
    } catch (err) {
      await notifyError(`Erreur directive : ${err.message}`);
    }
  });
}

start().catch(async (err) => {
  console.error('Erreur fatale :', err);
  await notifyError(`Erreur fatale mode autonome : ${err.message}`);
  process.exit(1);
});
