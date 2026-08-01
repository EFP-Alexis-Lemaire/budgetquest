require('dotenv').config({ path: '../../.env' });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = [
  'Tu es l\'agent Frontend de BudgetQuest.',
  'Tu es spécialisé dans : React 18, Vite, JSX, TailwindCSS, TanStack Query, Zustand, Recharts, React Router v6.',
  '',
  'Le projet BudgetQuest est une app de gestion de budget avec gamification (style RPG).',
  'Design : dark theme (gray-950 background), couleurs primaires violet (#6366f1).',
  'Composants existants : card, btn-primary, btn-secondary, input, badge (classes TailwindCSS custom).',
  '',
  'Conventions :',
  '- Composants fonctionnels avec hooks',
  '- Icones : lucide-react uniquement',
  '- Imports depuis src/ (pas d alias)',
  '',
  'REGLE ABSOLUE : Retourne UNIQUEMENT le code source brut JSX/JS.',
  'PAS de blocs markdown, PAS d explications, PAS de texte avant ou apres le code.',
  'Le fichier doit commencer directement par "import" ou "const" ou "export".',
  'Ne retourne jamais de json dans ta reponse, uniquement du code source pur.',
].join('\n');

async function runFrontendAgent(task, contextFiles = []) {
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

  console.log('[FrontendAgent] Tache recue : ' + task.substring(0, 100) + '...');

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
  console.log('[FrontendAgent] Tache completee.');
  return result;
}

module.exports = { runFrontendAgent };
