/**
 * BudgetQuest - Orchestrateur des agents IA
 * 
 * Ce fichier coordonne les agents Backend, Frontend et DevOps.
 * Les questions importantes sont relayées via Telegram.
 * 
 * Usage : node orchestrator.js
 */

require('dotenv').config({ path: '../.env' });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const { askHuman, notify, notifyError } = require('./telegram');
const { runBackendAgent } = require('./agents/backendAgent');
const { runFrontendAgent } = require('./agents/frontendAgent');
const { commitAndPush, getRepoStatus } = require('./agents/devopsAgent');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PROJECT_ROOT = path.join(__dirname, '../');

// ─── Utilitaires ─────────────────────────────────────────

function writeFile(relativePath, content) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`[Orchestrator] Fichier écrit : ${relativePath}`);
}

function extractCode(text) {
  // Extraire le code des blocs markdown si présent
  const match = text.match(/```(?:jsx?|tsx?|javascript|typescript)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

// ─── Décideur : faut-il poser une question ? ─────────────

async function shouldAskHuman(task) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Tu es l'orchestrateur d'une équipe d'agents IA qui développe une application web.
Tu dois décider si une tâche nécessite une validation humaine AVANT d'être exécutée.

Règles STRICTES pour poser une question :
- SEULEMENT si c'est une décision architecturale majeure et irréversible
- SEULEMENT si la tâche implique des changements de sécurité critiques  
- SEULEMENT si la tâche est ambiguë et que plusieurs interprétations sont possibles

NE PAS poser de question pour :
- Du code standard (routes, composants, styles)
- Des corrections de bugs
- Des améliorations mineures
- Des ajouts de features déjà spécifiées

Réponds uniquement en json : {"ask": true/false, "question": "...", "context": "..."}`
      },
      { role: 'user', content: `Tâche : ${task}` },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ─── Exécuteur de tâche ───────────────────────────────────

async function executeTask(task) {
  console.log(`\n[Orchestrator] ═══ Nouvelle tâche ═══`);
  console.log(`[Orchestrator] ${task.description}`);

  // Vérifier si on doit poser une question
  const decision = await shouldAskHuman(task.description);

  if (decision.ask) {
    console.log(`[Orchestrator] Question envoyée sur Telegram...`);
    const humanResponse = await askHuman(decision.question, decision.context);
    task.description += `\n\nPrécision reçue : ${humanResponse}`;
  }

  // Router vers le bon agent
  let result;
  switch (task.agent) {
    case 'backend':
      result = await runBackendAgent(task.description, task.contextFiles || []);
      if (task.outputFile) {
        writeFile(task.outputFile, extractCode(result));
      }
      break;

    case 'frontend':
      result = await runFrontendAgent(task.description, task.contextFiles || []);
      if (task.outputFile) {
        writeFile(task.outputFile, extractCode(result));
      }
      break;

    case 'devops':
      result = await commitAndPush(task.description, task.files);
      break;

    default:
      throw new Error(`Agent inconnu : ${task.agent}`);
  }

  return result;
}

// ─── Plan de développement initial ───────────────────────

const INITIAL_TASKS = [
  // Ces tâches seraient exécutées par les agents selon les besoins
  // L'orchestrateur est prêt à recevoir des tâches dynamiques
];

// ─── Démarrage ────────────────────────────────────────────

async function main() {
  console.log('🎮 BudgetQuest Orchestrator démarré');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await notify('🚀 Orchestrateur BudgetQuest démarré\nJe suis prêt à travailler. Envoyez-moi une tâche pour commencer !');

  // Écouter les messages Telegram pour recevoir des tâches
  const { bot } = require('./telegram');

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== process.env.TELEGRAM_CHAT_ID) return;

    const text = msg.text || '';

    // Commandes spéciales
    if (text === '/status') {
      const status = await getRepoStatus();
      await bot.sendMessage(chatId, `📊 *Status du repo*\n\nDerniers commits :\n${status.recentCommits.map(c => `• ${c.message}`).join('\n')}`, { parse_mode: 'Markdown' });
      return;
    }

    if (text === '/help') {
      await bot.sendMessage(chatId, `🎮 *BudgetQuest Bot*\n\n*Commandes :*\n/status - Voir l'état du repo\n/help - Aide\n\n*Tâches :*\nEnvoyez directement votre demande, ex:\n"Ajoute une page de profil utilisateur"\n"Corrige le bug sur les transactions"\n"Améliore le design du dashboard"`, { parse_mode: 'Markdown' });
      return;
    }

    // Tâche libre - l'orchestrateur détermine quel agent utiliser
    if (text.startsWith('/')) return; // Ignorer les autres commandes inconnues

    try {
      await bot.sendMessage(chatId, `⚙️ Tâche reçue, analyse en cours...`);

      // Déterminer le bon agent
      const routingResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Détermine quel agent doit traiter cette tâche pour le projet BudgetQuest.
Agents disponibles : "backend" (Express/API/DB), "frontend" (React/UI), "devops" (Git/Deploy).
Réponds uniquement en json : {"agent": "...", "description": "description détaillée de ce que l'agent doit faire", "outputFile": "chemin/du/fichier/à/créer.js ou null"}`
          },
          { role: 'user', content: text },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const routing = JSON.parse(routingResponse.choices[0].message.content);
      await bot.sendMessage(chatId, `🤖 Agent *${routing.agent}* assigné à la tâche...`, { parse_mode: 'Markdown' });

      const result = await executeTask(routing);

      await bot.sendMessage(chatId, `✅ Tâche complétée par l'agent *${routing.agent}*\n\n${routing.outputFile ? `Fichier créé : \`${routing.outputFile}\`` : 'Résultat traité.'}`, { parse_mode: 'Markdown' });

      // Auto-commit si un fichier a été créé
      if (routing.outputFile) {
        await commitAndPush(`feat: ${text.substring(0, 50)} (via agent ${routing.agent})`, ['.']);
      }

    } catch (err) {
      console.error('[Orchestrator] Erreur :', err);
      await notifyError(`Erreur lors de l'exécution : ${err.message}`);
    }
  });

  console.log('[Orchestrator] En attente de tâches via Telegram...');
}

main().catch(async (err) => {
  console.error('Erreur fatale :', err);
  await notifyError(`Erreur fatale : ${err.message}`);
  process.exit(1);
});
