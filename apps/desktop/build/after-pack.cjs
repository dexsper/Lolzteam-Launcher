const { readdir, rm } = require('node:fs/promises');
const { join } = require('node:path');

const KEEP = new Set(['en-US.pak', 'ru.pak']);

exports.default = async function afterPack(context) {
  const localesDir = join(context.appOutDir, 'locales');
  let entries;
  try {
    entries = await readdir(localesDir);
  } catch {
    return;
  }
  await Promise.all(
    entries
      .filter((name) => name.endsWith('.pak') && !KEEP.has(name))
      .map((name) => rm(join(localesDir, name), { force: true })),
  );
};
