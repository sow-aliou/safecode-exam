/**
 * autograder.js
 * Exécuteur de code sécurisé pour la correction automatique.
 * Supporte Java et Python. Le code est exécuté dans un process isolé
 * avec un timeout strict pour éviter les boucles infinies.
 */

import { execFile } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TIMEOUT_MS = 8000; // 8 secondes max par test
const TEMP_DIR = os.tmpdir();

/**
 * Exécute un programme et retourne stdout/stderr.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runProcess(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const proc = execFile(cmd, args, { timeout: TIMEOUT_MS, ...opts }, (err, stdout, stderr) => {
      if (err && err.killed) {
        reject(new Error('Timeout: Le programme a dépassé la limite de temps (8s).'));
      } else {
        resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: err ? (err.code || 1) : 0 });
      }
    });
    // Injecter stdin si fourni
    if (opts && opts.stdinData) {
      proc.stdin.write(opts.stdinData);
      proc.stdin.end();
    }
  });
}

/**
 * Normalise une chaîne de sortie pour la comparaison (trim, lowercase des espaces multiples).
 */
function normalize(str) {
  return (str || '').trim().replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
}

/**
 * Exécute du code Python avec un stdin et vérifie la sortie.
 */
async function runPython(code, input, expectedOutput) {
  const tmpFile = path.join(TEMP_DIR, `safecode_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
  try {
    fs.writeFileSync(tmpFile, code, 'utf8');
    const result = await runProcess('python3', [tmpFile], { stdinData: input });
    const got = normalize(result.stdout);
    const expected = normalize(expectedOutput);
    return { passed: got === expected, output: result.stdout, expected: expectedOutput, error: result.stderr || null };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

/**
 * Exécute du code Java avec un stdin et vérifie la sortie.
 * Nécessite javac + java dans le PATH.
 */
async function runJava(code, input, expectedOutput) {
  // Extraire le nom de la classe publique
  const classMatch = code.match(/public\s+class\s+(\w+)/);
  const className = classMatch ? classMatch[1] : 'Solution';
  const tmpDir = path.join(TEMP_DIR, `safecode_java_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const srcFile = path.join(tmpDir, `${className}.java`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(srcFile, code, 'utf8');

    // Compilation
    const compileResult = await runProcess('javac', [srcFile], { cwd: tmpDir });
    if (compileResult.exitCode !== 0) {
      return { passed: false, output: '', expected: expectedOutput, error: `Erreur de compilation:\n${compileResult.stderr}` };
    }

    // Exécution
    const runResult = await runProcess('java', ['-cp', tmpDir, className], { cwd: tmpDir, stdinData: input });
    const got = normalize(runResult.stdout);
    const expected = normalize(expectedOutput);
    return { passed: got === expected, output: runResult.stdout, expected: expectedOutput, error: runResult.stderr || null };
  } catch (err) {
    return { passed: false, output: '', expected: expectedOutput, error: err.message };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

/**
 * Auto-grade une copie entière.
 * @param {Object} copie  - { contenuCode: JSON string des réponses, ... }
 * @param {Array}  examQs - Questions de l'examen [ { id, typeReponse, points, testCases, ... } ]
 * @param {string} lang   - 'java' | 'python'
 * @returns {Promise<{ grades: Object, passed: number, total: number, details: Object }>}
 */
async function autoGradeCopie(copie, examQs, lang = 'python') {
  let answers = {};
  try {
    answers = JSON.parse(copie.contenuCode || '{}');
  } catch (_) {
    answers = {};
  }

  const grades = {};
  const details = {};
  let totalTests = 0;
  let passedTests = 0;

  for (const q of examQs) {
    if (q.typeReponse !== 'code' || !q.testCases || q.testCases.length === 0) {
      continue; // Seulement les questions code avec tests
    }

    const code = answers[q.id] || '';
    const qResults = [];
    let qPassed = 0;

    for (const tc of q.testCases) {
      let result;
      try {
        if (lang === 'java') {
          result = await runJava(code, tc.input, tc.expectedOutput);
        } else {
          result = await runPython(code, tc.input, tc.expectedOutput);
        }
      } catch (err) {
        result = { passed: false, output: '', expected: tc.expectedOutput, error: err.message };
      }

      qResults.push(result);
      if (result.passed) qPassed++;
      totalTests++;
      if (result.passed) passedTests++;
    }

    // Score proportionnel : pts * (passés / total_tests_de_la_question)
    const ratio = q.testCases.length > 0 ? qPassed / q.testCases.length : 0;
    grades[q.id] = Math.round(Number(q.points) * ratio * 10) / 10;
    details[q.id] = { results: qResults, passed: qPassed, total: q.testCases.length };
  }

  return { grades, passed: passedTests, total: totalTests, details };
}

export { autoGradeCopie };
