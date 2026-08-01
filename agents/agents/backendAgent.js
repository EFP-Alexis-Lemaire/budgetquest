require('dotenv').config({ path: '../../.env' });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = [
  'Tu es l\'agent Backend de BudgetQuest.',
  'Tu es specialise dans : ExpressJS, Node.js, API REST, Supabase (PostgreSQL), JWT, securite.',
  '',
  'Le projet est une app de gestion de budget avec gamification.',
  'Stack : Express + Supabase + JWT.',
  '',
  'REGLE ABSOLUE : Retourne UNIQUEMENT le code source brut JavaScript.',
  'PAS de blocs markdown, PAS d explications, PAS de texte avant ou apres le code.',
  'Le fichier doit commencer directement par "const", "require(" ou "module.exports".',
  'Pense a la securite (validation, sanitization).',
  'Ne retourne jamais de json dans ta reponse, uniquement du code source pur.',
].join('\n');

async function runBackendAgent(task, contextFiles = []) {
  const projectRoot = path.join(__dirname, '../../');

  let context = '';
  for (const file of contextFiles) {
    try {
      const content = fs.readFileSync(path.join(projectRoot, file), 'utf-8');
      context += '\n\n=== ' + file + ' ===\n' + content;
    } catch (e) {
      context += '\n\n=== ' + file + ' === (non trouve)';
    }
  }

  const userMessage = context
    ? task + '\n\nContexte des fichiers existants :' + context
    : task;

  console.log('[BackendAgent] Tache recue : ' + task.substring(0, 100) + '...');

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
  console.log('[BackendAgent] Tache completee.');
  return result;
}

module.exports = { runBackendAgent };
