require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');
const https = require('https');
const { notify, notifyError } = require('../telegram');

/**
 * Extrait l'ID du projet depuis l'URL Supabase
 * Ex: https://letrwitzgyubkkvrlnwz.supabase.co → letrwitzgyubkkvrlnwz
 */
function getProjectRef() {
  const url = process.env.SUPABASE_URL || '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error('SUPABASE_URL invalide');
  return match[1];
}

/**
 * Exécute du SQL via l'API de management Supabase
 * Utilise la service_role_key comme bearer token
 */
function executeSQLViaAPI(sql) {
  return new Promise((resolve, reject) => {
    const projectRef = getProjectRef();
    const token = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const body = JSON.stringify({ query: sql });

    const options = {
      hostname: `${projectRef}.supabase.co`,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': token,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || parsed.error || `HTTP ${res.statusCode}`));
          }
        } catch {
          resolve(data); // Réponse non-JSON (succès sans contenu)
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Applique un fichier SQL de migration via l'API Supabase Management
 * Utilise fetch vers l'endpoint /pg/query (API management v1)
 */
async function runMigration(migrationFile) {
  const fullPath = path.join(__dirname, '../../', migrationFile);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Fichier SQL introuvable : ${migrationFile}`);
  }

  const sql = fs.readFileSync(fullPath, 'utf-8');
  const projectRef = getProjectRef();

  console.log(`[SupabaseAgent] Migration : ${migrationFile}`);
  console.log(`[SupabaseAgent] Projet : ${projectRef}`);

  // L'API Management Supabase pour exécuter du SQL
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    // Si l'API management ne fonctionne pas, on log le SQL pour exécution manuelle
    const errMsg = `Erreur API Supabase (${response.status}): ${JSON.stringify(result)}`;
    console.error(`[SupabaseAgent] ${errMsg}`);

    // Envoyer le SQL sur Telegram pour exécution manuelle
    await notifyError(
      `Migration à exécuter manuellement dans Supabase SQL Editor :\n\n` +
      `Projet : ${projectRef}\n` +
      `Fichier : ${migrationFile}\n\n` +
      `Copie le contenu de \`${migrationFile}\` dans l'éditeur SQL Supabase.`
    );

    return { success: false, manual: true, file: migrationFile };
  }

  console.log(`[SupabaseAgent] Migration réussie !`);
  await notify(`✅ Migration appliquée : \`${migrationFile}\``);
  return { success: true, result };
}

/**
 * Applique toutes les migrations du dossier supabase/migrations/
 */
async function applyAllMigrations() {
  const migrationsDir = path.join(__dirname, '../../supabase/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[SupabaseAgent] ${files.length} migration(s) à appliquer`);

  const results = [];
  for (const file of files) {
    const result = await runMigration(`supabase/migrations/${file}`);
    results.push({ file, ...result });
  }

  return results;
}

/**
 * Crée une nouvelle migration SQL et l'applique
 * @param {string} name - Nom de la migration (ex: "add_notifications_table")
 * @param {string} sql - Contenu SQL
 */
async function createAndRunMigration(name, sql) {
  const migrationsDir = path.join(__dirname, '../../supabase/migrations');

  // Numérotation auto
  const existing = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  const nextNum = String(existing.length + 1).padStart(3, '0');
  const filename = `${nextNum}_${name}.sql`;
  const fullPath = path.join(migrationsDir, filename);

  // Écrire le fichier
  fs.writeFileSync(fullPath, sql, 'utf-8');
  console.log(`[SupabaseAgent] Nouvelle migration créée : ${filename}`);

  // L'appliquer
  return await runMigration(`supabase/migrations/${filename}`);
}

module.exports = { runMigration, applyAllMigrations, createAndRunMigration };
