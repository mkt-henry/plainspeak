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

// The argument hint copied verbatim still resolves to a real level.
assert.match(slash('[lite]'), /PLAINSPEAK ACTIVE — level: lite/);

// A bare level word switches too, since the command asks for exactly that word.
assert.match(prompt('strict'), /PLAINSPEAK ACTIVE — level: strict/);
assert.match(prompt('anything'), /PLAINSPEAK ACTIVE \(strict\)/);

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
assert.match(out, /Unknown plainspeak argument "turbo"/);
assert.match(prompt('anything'), /PLAINSPEAK ACTIVE \(strict\)/);

// Setup hands the model the interview plus the path to persist answers to.
out = slash('setup');
assert.match(out, /PLAINSPEAK SETUP/);
assert.match(out, /ONE question at a time/);
assert.match(out, /tone: formal \| neutral \| friendly/);
assert.ok(out.includes(path.join(configDir, '.plainspeak-style')), 'must name the save path');

// With no style file, nothing about style is injected anywhere.
assert.doesNotMatch(activate(), /## Talking style/);
assert.doesNotMatch(prompt('add a login page'), /Style:/);

const stylePath = path.join(configDir, '.plainspeak-style');
const writeStyle = value => fs.writeFileSync(stylePath, JSON.stringify(value), 'utf8');

// Chosen values reach the full injection as rules, and the per-turn line as a short tag.
writeStyle({ tone: 'friendly', address: 'casual', emoji: 'on' });
out = activate();
assert.match(out, /## Talking style \(chosen by this user\)/);
assert.match(out, /relaxed and conversational/);
assert.match(out, /반말/);
assert.match(out, /One emoji per reply/);
assert.doesNotMatch(out, /two or three lines/, 'untouched knobs must stay silent');
assert.match(out, /never override the rules on money/, 'safety rules stay non-negotiable');

out = prompt('add a login page');
assert.match(out, /Style: tone=friendly, address=casual, emoji=on\./);
assert.ok(out.length < 500, 'reinforcement must stay small, got ' + out.length);

// Values equal to the default, unknown keys and junk values are all ignored.
writeStyle({ tone: 'neutral', lists: 'maybe', bogus: 'x' });
assert.doesNotMatch(activate(), /## Talking style/);
fs.writeFileSync(stylePath, 'not json', 'utf8');
assert.doesNotMatch(activate(), /## Talking style/);

// Reset clears the style and leaves the level alone.
writeStyle({ length: 'short' });
assert.match(activate(), /Length: two or three lines/);
out = slash('reset');
assert.match(out, /PLAINSPEAK style reset/);
assert.strictEqual(fs.existsSync(stylePath), false);
out = activate();
assert.match(out, /level: strict/, 'reset must not touch the level');
assert.doesNotMatch(out, /## Talking style/);

// Off stays off across sessions.
assert.match(prompt('stop plainspeak'), /PLAINSPEAK OFF/);
assert.strictEqual(prompt('add a login page'), '');
assert.strictEqual(activate(), 'OK');

// While off, a bare level word is just an ordinary prompt.
assert.strictEqual(prompt('strict'), '');

// And turning it back on clears the off state.
assert.match(slash('lite'), /level: lite/);
assert.match(activate(), /level: lite/);

fs.rmSync(configDir, { recursive: true, force: true });
console.log('all checks passed');
