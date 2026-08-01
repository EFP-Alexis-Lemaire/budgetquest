require('dotenv').config({ path: '../.env' });
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// File d'attente des questions en attente de réponse
const pendingQuestions = new Map();

/**
 * Envoie une question à l'humain sur Telegram et attend sa réponse.
 * @param {string} question - La question de l'agent
 * @param {string} context - Contexte additionnel
 * @returns {Promise<string>} - La réponse de l'humain
 */
function askHuman(question, context = '') {
  return new Promise((resolve) => {
    const id = Date.now().toString();
    const message = `
🤖 *Question de l'équipe BudgetQuest*
━━━━━━━━━━━━━━━━━━━
${context ? `📋 *Contexte :* ${context}\n\n` : ''}❓ *Question :* ${question}

_Répondez à ce message pour continuer le travail._
🆔 ID: \`${id}\`
    `.trim();

    bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
    pendingQuestions.set(id, resolve);

    console.log(`[Telegram] Question envoyée (ID: ${id}): ${question}`);
  });
}

/**
 * Envoie une notification (pas de réponse attendue)
 */
function notify(message) {
  const text = `✅ *BudgetQuest Update*\n\n${message}`;
  return bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
}

/**
 * Envoie une erreur
 */
function notifyError(error) {
  const text = `❌ *Erreur BudgetQuest*\n\n\`\`\`\n${error}\n\`\`\``;
  return bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
}

// Écouter les réponses de l'humain
bot.on('message', (msg) => {
  if (msg.chat.id.toString() !== CHAT_ID) return;

  const text = msg.text || '';

  // Chercher un ID dans le message (si c'est une réponse à une question)
  // On prend la dernière question en attente si pas d'ID spécifié
  if (pendingQuestions.size > 0) {
    // Chercher si le texte contient un ID connu
    let matchedId = null;
    for (const [id] of pendingQuestions) {
      if (text.includes(id)) {
        matchedId = id;
        break;
      }
    }

    // Sinon, répondre à la plus ancienne question
    if (!matchedId) {
      matchedId = [...pendingQuestions.keys()][0];
    }

    if (matchedId) {
      const resolve = pendingQuestions.get(matchedId);
      pendingQuestions.delete(matchedId);
      bot.sendMessage(CHAT_ID, `✅ Réponse reçue ! L'équipe continue le travail...`);
      console.log(`[Telegram] Réponse reçue pour ${matchedId}: ${text}`);
      resolve(text);
    }
  }
});

module.exports = { askHuman, notify, notifyError, bot };
