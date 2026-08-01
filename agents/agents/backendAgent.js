const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Tu es l'agent Backend de BudgetQuest.
Tu es spécialisé dans :
- ExpressJS, Node.js, API REST
- Supabase (PostgreSQL, RLS, fonctions SQL)
- Authentification JWT, sécurité
- Architecture backend propre et maintenable

Le projet est une app de gestion de budget avec gamification.
Stack : Express + Supabase + JWT.

RÈGLE ABSOLUE : Retourne UNIQUEMENT le code source brut JavaScript.
- PAS de blocs markdown (\`\`\`)
- PAS d'explications, de titres, de commentaires hors du code
- PAS de texte avant ou après le code
- Le fichier doit commencer directement par "const", "require(" ou "module.exports"
- Pense à la sécurité (validation, sanitization)
- Ne retourne jamais de json dans ta réponse, uniquement du code source pur`;

/**
 * Demande à l'agent backend d'effectuer une tâche
 * @param {string} task - Description de la tâche
 * @param {string[]} contextFiles - Fichiers à lire pour le contexte
 */
async function runBackendAgent(task, contextFiles = []) {
  const projectRoot = path.join(__dirname, '../../');

  // Lire les fichiers de contexte
  let context = '';
  for (const file of contextFiles) {
    try {
      const content = fs.readFileSync(path.join(projectRoot, file), 'utf-8');
      context += `\n\n=== ${file} ===\n${content}`;
    } catch (e) {
      context += `\n\n=== ${file} === (non trouvé)`;
    }
  }

  const userMessage = context
    ? `${task}\n\nContexte des fichiers existants :${context}`
    : task;

  console.log(`[BackendAgent] Tâche reçue : ${task.substring(0, 100)}...`);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: 4096,
  });

  const result = response.choices[0].message.content;
  console.log(`[BackendAgent] Tâche complétée.`);
  return result;
}

module.exports = { runBackendAgent };
