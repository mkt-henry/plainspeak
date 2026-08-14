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
    const requested = strip(command[1]) || lib.DEFAULT_LEVEL;
    if (requested === 'off') return turnOff();
    if (requested === 'setup') return setup();
    if (requested === 'reset') return resetStyle();
    if (lib.LEVELS.includes(requested)) return turnOn(requested);
    return 'Unknown plainspeak argument "' + requested + '". Valid: ' +
      lib.LEVELS.join(', ') + ', off, setup, reset. Tell the user, and leave everything unchanged.';
  }

  const level = lib.readLevel();

  if (allowNaturalLanguage) {
    if (/\b(stop plainspeak|normal mode|plainspeak off)\b/.test(prompt)) return turnOff();
    if (/\b(plainspeak on|start plainspeak)\b/.test(prompt)) return turnOn(lib.DEFAULT_LEVEL);
    // A bare level word answers the question the command itself asks ("which
    // level?"), so honour it — but only while plainspeak is already running,
    // or "off" in an unrelated conversation would switch it on to switch it off.
    const bare = level && strip(prompt);
    if (bare === 'off') return turnOff();
    if (bare && lib.LEVELS.includes(bare)) return turnOn(bare);
  }

  if (!level) return '';
  return REINFORCE.replace('%LEVEL%', level) + lib.styleSuffix(lib.readStyle());
}

// Peel off decoration around the level word: users copy the argument hint
// verbatim ("/plainspeak [strict]"), or quote, backtick or punctuate it.
function strip(value) {
  return (value || '').replace(/^[^a-z]+/, '').replace(/[^a-z]+$/, '');
}

function turnOn(level) {
  try { fs.unlinkSync(offMarker); } catch (e) {}
  lib.writeLevel(level);
  const style = lib.readStyle();
  const body = lib.readSkillBody();
  return body
    ? 'PLAINSPEAK ACTIVE — level: ' + level + '\n\n' + lib.filterToLevel(body, level) +
      lib.styleBlock(style)
    : REINFORCE.replace('%LEVEL%', level) + lib.styleSuffix(style);
}

// The interview itself is the model's job — it has to be conversational and in the
// user's language. The hook only supplies the questions, the vocabulary and where
// to persist the answers.
function setup() {
  const options = Object.keys(lib.STYLE)
    .map(key => '  ' + key + ': ' + lib.STYLE[key].values.join(' | ') +
      '   (default: ' + lib.STYLE[key].default + ')')
    .join('\n');

  return [
    'PLAINSPEAK SETUP — run this now, before anything else in this turn.',
    '',
    'Interview the user about how they want you to talk. Ask ONE question at a time, in',
    'their language, in plain product words — never show these keys or values to them.',
    'Ask only the questions that mean something in their language; skip any that do not and',
    'leave that key unset. Question 2 is the usual case — it applies only where the language',
    'has both a formal and an informal register.',
    'Open by telling them you will ask a few quick questions one at a time, and that they can',
    'say "the rest as default" at any point to stop early. Do not name a number.',
    '',
    '1. tone — businesslike, in between, or relaxed and friendly?',
    '2. address — formal speech, or casual (반말 / du / tu) where the language has both?',
    '3. warmth — just the facts, or a word of encouragement when it fits?',
    '4. length — two or three lines, the usual few, or room for up to about ten?',
    '5. lists — plain sentences only, or bullet lists and small sub-headings when there are several items?',
    '6. emoji — never, or one now and then?',
    '7. paragraphs — one block of text, or blank lines between separate points?',
    '',
    'Allowed values:',
    options,
    '',
    'When the interview ends, write the answers as a JSON object to this exact path,',
    'creating or overwriting the file:',
    '  ' + lib.stylePath,
    'Include only the keys they moved off the default; omit the rest. Example:',
    '  {"tone":"friendly","address":"casual","emoji":"on"}',
    '',
    'Then confirm in one or two short sentences how you will sound from now on, written',
    'in the new style so they can hear it. Never show the path, the file, the JSON, or',
    'the option names. Apply the new style from that same reply onward.',
  ].join('\n');
}

function resetStyle() {
  lib.clearStyle();
  return 'PLAINSPEAK style reset — every talking-style choice is back to default. The level ' +
    'is unchanged. Tell the user in one short sentence, and drop back to the default voice now.';
}

function turnOff() {
  lib.clearLevel();
  try { fs.writeFileSync(offMarker, '1', 'utf8'); } catch (e) {}
  return 'PLAINSPEAK OFF. Resume normal technical communication from this response on.';
}
