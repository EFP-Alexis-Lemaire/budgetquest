/**
 * BudgetQuest - Script de setup initial
 * Lance les migrations Supabase et vérifie la configuration
 * 
 * Usage : node agents/setup.js
 */

require('dotenv').config({ path: './.env' });
const { applyAllMigrations } = require('./agents/supabaseAgent');
const { notify } = require('./telegram');

async function setup() {
  console.log('🎮 BudgetQuest - Setup initial');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Vérifier les variables d'environnement
  const required = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Variables manquantes dans .env : ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ Variables d\'environnement OK');

  // Appliquer les migrations
  console.log('\n📦 Application des migrations Supabase...');
  try {
    const results = await applyAllMigrations();

    const success = results.filter(r => r.success).length;
    const manual = results.filter(r => r.manual).length;

    if (manual > 0) {
      console.log(`\n⚠️  ${manual} migration(s) nécessitent une exécution manuelle.`);
      console.log('📱 Instructions envoyées sur Telegram.');
      console.log('\n👉 Va dans Supabase → SQL Editor et exécute le fichier :');
      console.log('   supabase/migrations/001_initial_schema.sql');
    } else {
      console.log(`\n✅ ${success} migration(s) appliquée(s) avec succès !`);
    }
  } catch (err) {
    console.error('Erreur migrations :', err.message);
    console.log('\n👉 Exécute manuellement dans Supabase SQL Editor :');
    console.log('   supabase/migrations/001_initial_schema.sql');
  }

  console.log('\n🚀 Setup terminé ! Lance l\'app avec :');
  console.log('   cd backend && npm run dev');
  console.log('   cd frontend && npm run dev');
  console.log('   cd agents && node orchestrator.js');

  process.exit(0);
}

setup().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
