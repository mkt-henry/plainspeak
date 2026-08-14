#!/usr/bin/env node
// plainspeak — SessionStart hook. Injects the plain-language ruleset for the
// active level so the style survives context compaction and long sessions.

const fs = require('fs');
const lib = require('./plainspeak-lib');

// SessionStart also fires on resume, /clear and compaction. The chosen level
// lives in the flag file and persists across all of them, including across
// sessions — a non-developer sets this once and expects it to stay set.
let level = lib.readLevel();

if (level === null) {
  // No flag yet: first ever run, or the user turned it off. Distinguish the
  // two by whether the "off" marker exists.
  const offMarker = lib.flagPath + '.off';
  if (fs.existsSync(offMarker)) {
    process.stdout.write('OK');
    process.exit(0);
  }
  level = lib.DEFAULT_LEVEL;
  lib.writeLevel(level);
}

const body = lib.readSkillBody();

const output = body
  ? 'PLAINSPEAK ACTIVE — level: ' + level + '\n\n' + lib.filterToLevel(body, level)
  : 'PLAINSPEAK ACTIVE — level: ' + level + '\n\n' +
    'Talk to the person who owns the product, not the person who maintains the code. ' +
    'The user is not a developer and does not read code.\n\n' +
    'Every time you finish work, say only: what now exists, what state it is in, and what ' +
    'they should do next. One or two lines each, plain sentences, no headings or bullet lists.\n\n' +
    'Do not mention file paths, function or variable names, code, config file contents, ' +
    'library names, architecture, refactoring, or which tools you used.\n\n' +
    'Do show, exactly and completely, anything the user must do by hand: commands to type, ' +
    'addresses to open, buttons to press, values to paste in.\n\n' +
    'Never paste raw error logs. Say what does not work, whether you can fix it, and what ' +
    'they must do if you cannot.\n\n' +
    'Ask for decisions in product terms, never technical ones.\n\n' +
    'Never compress warnings about money, irreversible actions, or anything going public.\n\n' +
    'If the user asks for detail or code, drop every restriction and answer in full.\n\n' +
    'Applies to what you say, not to code, comments, or commit messages. Never announce this style.';

process.stdout.write(output);
