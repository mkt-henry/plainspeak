#!/usr/bin/env node
// End-to-end check of the two hooks. Run: node test/test-hooks.js
// Uses a throwaway CLAUDE_CONFIG_DIR so it never touches a real install.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plainspeak-test-'));
const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir, CLAUDE_PLUGIN_ROOT: root };

const run = (hook, payload) =>
  execFileSync('node', [path.join(root, 'src', 'hooks', hook)], {
    input: JSON.stringify(payload),
    env,
    encoding: 'utf8',
  });

const activate = () => run('plainspeak-activate.js', { source: 'startup' });
const prompt = text => run('plainspeak-tracker.js', { prompt: text });
const slash = args =>
  prompt(`<command-name>/plainspeak</command-name><command-args>${args}</command-args>`);

// First session defaults to full and injects the ruleset.
let out = activate();
assert.match(out, /PLAINSPEAK ACTIVE — level: full/);
assert.match(out, /what now exists/i, 'ruleset body should be injected');

// Only the active level's row and example survive the filter.
assert.match(out, /^\| \*\*full\*\* \|/m);
assert.doesNotMatch(out, /^\| \*\*strict\*\* \|/m);
assert.doesNotMatch(out, /^- strict: /m);

// Slash command switches level and restates the rules at that level.
out = slash('strict');
assert.match(out, /PLAINSPEAK ACTIVE — level: strict/);
assert.match(out, /^\| \*\*strict\*\* \|/m);
assert.doesNotMatch(out, /^\| \*\*lite\*\* \|/m);

// The level persists into the next session rather than resetting.
assert.match(activate(), /level: strict/);

// An ordinary prompt gets the cheap per-turn reinforcement, not the full body.
out = prompt('add a login page');
assert.match(out, /PLAINSPEAK ACTIVE \(strict\)/);
assert.ok(out.length < 400, 'reinforcement must stay small, got ' + out.length);

// A foreign slash command must not be treated as ours.
out = prompt('<command-name>/commit</command-name><command-args>off</command-args>');
assert.match(out, /PLAINSPEAK ACTIVE \(strict\)/, 'another command must not switch level');

// Scheduled runs are left completely alone.
assert.strictEqual(prompt('<scheduled-task id="1">do the thing</scheduled-task>'), '');

// An unknown level is reported without silently changing anything.
out = slash('turbo');
assert.match(out, /Unknown plainspeak level "turbo"/);
assert.match(prompt('anything'), /PLAINSPEAK ACTIVE \(strict\)/);

// Off stays off across sessions.
assert.match(prompt('stop plainspeak'), /PLAINSPEAK OFF/);
assert.strictEqual(prompt('add a login page'), '');
assert.strictEqual(activate(), 'OK');

// And turning it back on clears the off state.
assert.match(slash('lite'), /level: lite/);
assert.match(activate(), /level: lite/);

fs.rmSync(configDir, { recursive: true, force: true });
console.log('all checks passed');
