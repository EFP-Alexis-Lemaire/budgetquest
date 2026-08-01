const { Octokit } = require('@octokit/rest');
const simpleGit = require('simple-git');
const path = require('path');
const { notify, notifyError } = require('../telegram');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [GITHUB_OWNER, GITHUB_REPO] = (process.env.GITHUB_REPO || '').split('/');

const git = simpleGit(path.join(__dirname, '../../'));

/**
 * Commit et push les changements sur GitHub
 * @param {string} message - Message de commit
 * @param {string[]} files - Fichiers à ajouter (défaut: tout)
 */
async function commitAndPush(message, files = ['.']) {
  try {
    console.log(`[DevOpsAgent] Commit : ${message}`);

    // Stage les fichiers
    for (const file of files) {
      await git.add(file);
    }

    // Vérifier s'il y a des changements
    const status = await git.status();
    if (status.staged.length === 0) {
      console.log('[DevOpsAgent] Aucun changement à committer.');
      return { success: false, message: 'Aucun changement détecté.' };
    }

    // Commit
    await git.commit(message);

    // Push
    await git.push('origin', 'main');

    const successMsg = `✅ Push réussi : "${message}" (${status.staged.length} fichiers)`;
    console.log(`[DevOpsAgent] ${successMsg}`);
    await notify(successMsg);

    return { success: true, message: successMsg };
  } catch (err) {
    const errMsg = `Erreur Git : ${err.message}`;
    console.error(`[DevOpsAgent] ${errMsg}`);
    await notifyError(errMsg);
    return { success: false, message: errMsg };
  }
}

/**
 * Crée une issue GitHub
 */
async function createIssue(title, body, labels = []) {
  try {
    const { data } = await octokit.issues.create({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      title,
      body,
      labels,
    });
    console.log(`[DevOpsAgent] Issue créée : #${data.number} - ${title}`);
    return data;
  } catch (err) {
    console.error(`[DevOpsAgent] Erreur création issue : ${err.message}`);
    throw err;
  }
}

/**
 * Obtient le statut du repo
 */
async function getRepoStatus() {
  const status = await git.status();
  const log = await git.log({ maxCount: 5 });
  return { status, recentCommits: log.all };
}

module.exports = { commitAndPush, createIssue, getRepoStatus };
