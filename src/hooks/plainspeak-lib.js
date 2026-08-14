// plainspeak — shared helpers for the SessionStart and UserPromptSubmit hooks.

const fs = require('fs');
const path = require('path');
const os = require('os');

const LEVELS = ['lite', 'full', 'strict'];
const DEFAULT_LEVEL = 'full';

// Talking style, orthogonal to level: level decides what is hidden, style decides
// how the surviving text sounds. Every default reproduces the pre-style behaviour,
// so an install that never runs setup is unchanged.
const STYLE = {
  tone: { values: ['formal', 'neutral', 'friendly'], default: 'neutral' },
  address: { values: ['polite', 'casual'], default: 'polite' },
  warmth: { values: ['plain', 'warm'], default: 'plain' },
  length: { values: ['short', 'normal', 'roomy'], default: 'normal' },
  lists: { values: ['off', 'on'], default: 'off' },
  emoji: { values: ['off', 'on'], default: 'off' },
  paragraphs: { values: ['spaced', 'tight'], default: 'spaced' },
};

// Only non-default values need a rule — the defaults are already the base ruleset.
const STYLE_RULES = {
  tone: {
    formal: 'Tone: businesslike. State the result and stop; no small talk, no warmth padding.',
    friendly: 'Tone: relaxed and conversational, the way you would tell a colleague you get on with. Jargon rules are unchanged.',
  },
  address: {
    casual: 'Address the user casually: in languages with a formal register (Korean 반말, Japanese plain form, German du, French tu), use the informal one. Stay respectful.',
  },
  warmth: {
    warm: 'Encouragement is welcome — a brief word of praise or reassurance when it genuinely fits. Never manufacture it, and never soften bad news with it.',
  },
  length: {
    short: 'Length: two or three lines. Keep the result and the next action, cut the rest.',
    roomy: 'Length: up to about ten lines when the work warrants it. Extra room buys more product detail, never implementation detail.',
  },
  lists: {
    on: 'Bullet lists and short sub-headings are allowed when there are genuinely several parallel items. A single continuous point still stays prose.',
  },
  emoji: {
    on: 'One emoji per reply is allowed where it adds warmth. Never a decorative row, never one per line.',
  },
  paragraphs: {
    tight: 'Keep the reply as one block — no blank lines between sentences.',
  },
};

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.plainspeak-active');
const stylePath = path.join(claudeDir, '.plainspeak-style');

function readLevel() {
  try {
    const value = fs.readFileSync(flagPath, 'utf8').trim();
    return LEVELS.includes(value) ? value : null;
  } catch (e) {
    return null;
  }
}

// Write through any symlink rather than replacing it, so a user who symlinks
// their .claude dir keeps the link intact.
function writeLevel(level) {
  try {
    fs.writeFileSync(flagPath, level, 'utf8');
  } catch (e) { /* a read-only config dir must not break the session */ }
}

function clearLevel() {
  try { fs.unlinkSync(flagPath); } catch (e) {}
}

// The skill file is the single source of truth for the ruleset, so edits to it
// propagate to the injected context with no duplicated copy to go stale.
function readSkillBody() {
  const candidates = [];
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    candidates.push(path.join(process.env.CLAUDE_PLUGIN_ROOT, 'skills', 'plainspeak', 'SKILL.md'));
  }
  candidates.push(
    path.join(__dirname, '..', '..', 'skills', 'plainspeak', 'SKILL.md'),
    path.join(__dirname, '..', 'skills', 'plainspeak', 'SKILL.md')
  );
  for (const candidate of candidates) {
    try {
      return fs.readFileSync(candidate, 'utf8').replace(/^---[\s\S]*?---\s*/, '');
    } catch (e) { /* try next */ }
  }
  return '';
}

// Keep only the active level's row in the intensity table and its example line.
// Every other level is noise that invites the model to blend behaviours.
function filterToLevel(body, level) {
  return body.split('\n').filter(line => {
    const tableRow = line.match(/^\|\s*\*\*(\S+?)\*\*\s*\|/);
    if (tableRow) return tableRow[1] === level;
    const example = line.match(/^- (\S+?):\s/);
    if (example) return LEVELS.includes(example[1]) ? example[1] === level : true;
    return true;
  }).join('\n');
}

// Returns only the keys the user actually moved off their default. Anything
// unreadable, unknown or out of range is dropped rather than failing the hook.
function readStyle() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(stylePath, 'utf8'));
  } catch (e) {
    return {};
  }
  const chosen = {};
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(STYLE)) {
      const value = raw[key];
      if (STYLE[key].values.includes(value) && value !== STYLE[key].default) chosen[key] = value;
    }
  }
  return chosen;
}

function clearStyle() {
  try { fs.unlinkSync(stylePath); } catch (e) {}
}

// Appended after level filtering so a style rule can never be mistaken for a
// level row and stripped.
function styleBlock(style) {
  const rules = Object.keys(STYLE)
    .map(key => style[key] && STYLE_RULES[key][style[key]])
    .filter(Boolean);
  if (!rules.length) return '';
  return '\n\n## Talking style (chosen by this user)\n\n' +
    rules.map(rule => '- ' + rule).join('\n') +
    '\n\nThese adjust wording only. They never override the rules on money, irreversible ' +
    'or public actions, or on showing verbatim anything the user must run, open or paste.';
}

// Compact enough to ride along with the per-turn reinforcement without bloating it.
function styleSuffix(style) {
  const pairs = Object.keys(STYLE).filter(key => style[key]).map(key => key + '=' + style[key]);
  return pairs.length ? ' Style: ' + pairs.join(', ') + '.' : '';
}

module.exports = {
  LEVELS, DEFAULT_LEVEL, STYLE, claudeDir, flagPath, stylePath,
  readLevel, writeLevel, clearLevel, readSkillBody, filterToLevel,
  readStyle, clearStyle, styleBlock, styleSuffix,
};
