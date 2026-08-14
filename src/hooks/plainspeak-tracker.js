#!/usr/bin/env node
// plainspeak — UserPromptSubmit hook. Switches level on /plainspeak, and
// re-states the rule once per turn so the style does not decay over a long
// session the way a single SessionStart injection does.

const fs = require('fs');
const lib = require('./plainspeak-lib');

const offMarker = lib.flagPath + '.off';

const REINFORCE = 'PLAINSPEAK ACTIVE (%LEVEL%) — user is not a developer. Report what now ' +
  'works, its state, and what they must do. No paths, code, or library names unless they ' +
  'asked for detail. Show verbatim anything they must run or paste.';

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
// A broken pipe must not surface as a failed hook — always exit 0.
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    process.stdout.write(handle(input));
  } catch (e) { /* never block a prompt over styling */ }
  process.exit(0);
});

function handle(raw) {
  const data = JSON.parse(raw);
  let prompt = (data.prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');

  // Unattended scheduled runs must not be styled — the task prompt owns the
  // output format, and a plain-language wrapper would hijack it.
  if (/<scheduled-task\b/.test(prompt)) return '';

  // Claude Code delivers slash commands as an envelope, not the literal text:
  //   <command-name>/plainspeak</command-name><command-args>strict</command-args>
  // Rebuild "<name> <args>" for our own command; leave other commands alone so
  // their arguments cannot trip our natural-language triggers.
  let allowNaturalLanguage = true;
  const envName = /<command-name>\s*([^<\s]+)\s*<\/command-name>/.exec(prompt);
  if (envName) {
    if (/^\/(plainspeak:)?plainspeak$/.test(envName[1])) {
      const envArgs = /<command-args>\s*([^<]*?)\s*<\/command-args>/.exec(prompt);
      const args = envArgs ? envArgs[1].trim() : '';
      prompt = args ? '/plainspeak ' + args : '/plainspeak';
    } else {
      allowNaturalLanguage = false;
    }
  }

  const command = /^\/(?:plainspeak:)?plainspeak(?:\s+(\S+))?$/.exec(prompt);
  if (command) {
    const requested = (command[1] || lib.DEFAULT_LEVEL).toLowerCase();
    if (requested === 'off') return turnOff();
    if (lib.LEVELS.includes(requested)) return turnOn(requested);
    return 'Unknown plainspeak level "' + requested + '". Valid: ' +
      lib.LEVELS.join(', ') + ', off. Tell the user, and leave the current level unchanged.';
  }

  if (allowNaturalLanguage) {
    if (/\b(stop plainspeak|normal mode|plainspeak off)\b/.test(prompt)) return turnOff();
    if (/\b(plainspeak on|start plainspeak)\b/.test(prompt)) return turnOn(lib.DEFAULT_LEVEL);
  }

  const level = lib.readLevel();
  if (!level) return '';
  return REINFORCE.replace('%LEVEL%', level);
}

function turnOn(level) {
  try { fs.unlinkSync(offMarker); } catch (e) {}
  lib.writeLevel(level);
  const body = lib.readSkillBody();
  return body
    ? 'PLAINSPEAK ACTIVE — level: ' + level + '\n\n' + lib.filterToLevel(body, level)
    : REINFORCE.replace('%LEVEL%', level);
}

function turnOff() {
  lib.clearLevel();
  try { fs.writeFileSync(offMarker, '1', 'utf8'); } catch (e) {}
  return 'PLAINSPEAK OFF. Resume normal technical communication from this response on.';
}
