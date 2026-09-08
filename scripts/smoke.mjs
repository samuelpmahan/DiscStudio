import { access, readFile } from 'node:fs/promises';
const expected = ['dist/index.html', 'dist/concept-a/index.html', 'dist/concept-a/app.js', 'dist/concept-b/index.html', 'dist/candidate/index.html'];
await Promise.all(expected.map((file) => access(file)));
const root = await readFile('dist/index.html', 'utf8');
if (!root.includes('concept-a') || !root.includes('concept-b') || !root.includes('candidate')) throw new Error('Root chooser does not link to both concepts and the candidate.');
console.log(`Smoke passed: ${expected.join(', ')}`);
