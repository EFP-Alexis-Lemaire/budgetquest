const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Tu es l'agent Frontend de BudgetQuest.
Tu es spécialisé dans :
- React 18, Vite, JSX
- TailwindCSS (dark theme, design system existant)
- TanStack Query (useQuery, useMutation)
- Zustand (state management)
- Recharts (graphiques)
- React Router v6
- Accessibilité (ARIA, sémantique HTML)

Le projet BudgetQuest est une app de gestion de budget avec gamification (style RPG).
Design : dark theme (gray-950 background), couleurs primaires violet (#6366f1).
Composants existants : card, btn-primary, btn-secondary, input, badge (classes TailwindCSS custom).

Conventions :
- Composants fonctionnels avec hooks
- Pas de classes CSS custom sauf celles définies dans index.css
- Icônes : lucide-react uniquement
- Imports depuis '@/' (alias vers src/)

Retourne UNIQUEMENT le code JSX/JS demandé, complet et fonctionnel.
Ne retourne jamais de json dans ta réponse, uniquement du code source.`;

async function runFrontendAgent(task, contextFiles = []) {
  const projectRoot = path.join(__dirname, '../../');

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

  console.log(`[FrontendAgent] Tâche reçue : ${task.substring(0, 100)}...`);

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
  console.log(`[FrontendAgent] Tâche complétée.`);
  return result;
}

module.exports = { runFrontendAgent };
