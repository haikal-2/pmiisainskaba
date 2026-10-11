const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '../..');

for (const file of [
  'src/components/admin/AdminLoginForm.tsx',
  'src/components/admin/AdminModuleView.tsx',
]) {
  test(`${file} has no TypeScript syntax diagnostics`, async () => {
    const source = await readFile(path.join(projectRoot, file), 'utf8');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: file,
      reportDiagnostics: true,
    });
    const syntaxErrors = (result.diagnostics ?? [])
      .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

    assert.deepEqual(syntaxErrors, []);
  });
}
