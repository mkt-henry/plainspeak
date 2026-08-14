// plainspeak — shared helpers for the SessionStart and UserPromptSubmit hooks.

const fs = require('fs');
const path = require('path');
const os = require('os');

const LEVELS = ['lite', 'full', 'strict'];
const DEFAULT_LEVEL = 'full';

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.plainspeak-active');

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

module.exports = { LEVELS, DEFAULT_LEVEL, claudeDir, flagPath, readLevel, writeLevel, clearLevel, readSkillBody, filterToLevel };
