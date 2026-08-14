# plainspeak

A Claude Code plugin that makes Claude report to you like a product owner, not a code reviewer.

**Before**

> Added a CartProvider in `src/components/Cart.tsx` using useReducer for state. Defined `addItem` / `removeItem` actions, handled localStorage sync in a useEffect, and split the types out into `types/cart.ts`.

**After**

> Added the shopping cart.
> You can add items and change quantities in the browser now.
> Have a look: click add on a product and check the count goes up right.

Claude's default is to report to you like you are a colleague who will read the diff. You get file paths, function names, library choices, and code blocks. If you vibe code — you have the product judgment but you do not read code — most of that is noise you cannot act on.

plainspeak changes what Claude says, not how it works. Same engineering, different report.

## Install

```
/plugin marketplace add mkt-henry/plainspeak
/plugin install plainspeak@plainspeak
```

Restart Claude Code. It is on from that point, in every project.

## Levels

```
/plainspeak lite      technical terms explained in plain words rather than hidden
/plainspeak full      default — what works, and what you should do
/plainspeak strict    only what you must do by hand
/plainspeak off       back to normal
```

Your choice is remembered across sessions. "stop plainspeak" and "normal mode" also turn it off.

## Voice

Levels decide what gets hidden. How the rest sounds is a separate set of choices:

```
/plainspeak setup     one question at a time — answer and it is remembered
/plainspeak reset     back to the default voice, level untouched
```

You are asked one thing at a time, and only about the choices that mean something in the language
you write in: tone (businesslike / in between / relaxed), formal or casual address where the
language has both — 반말, du, tu — whether a word of encouragement is welcome, answer length,
whether bullet lists and small sub-headings are allowed, whether emoji are allowed, and whether
separate points get blank lines between them. Say "the rest as default" at any point to stop
early.

Answer nothing and plainspeak behaves exactly as it did before: plain sentences, three to five
lines, no lists, no emoji.

No setting at any level can hide a command you have to type, an address you have to open, a
value you have to paste, or a warning about something that costs money, cannot be undone, or
goes public.

## What it does and does not hide

Hidden by default: file paths, function and variable names, code, config file contents, library and framework names, architecture and refactoring talk, developer vocabulary.

Never hidden, at any level:

- Commands you have to type, addresses you have to open, buttons you have to press, keys you have to paste in — given exactly and completely
- Warnings about anything that costs money, cannot be undone, or goes public
- Anything you asked for. Say "show me the code" or "explain in detail" and every restriction lifts

It also changes how Claude asks you questions. Instead of "JWT or session auth?" you get "Once someone logs in, how long should they stay logged in — a day, or a month?"

Code, comments, and commit messages stay in normal technical language. This is about what Claude says to you.

## How it works

A `SessionStart` hook injects the ruleset for your active level, and a `UserPromptSubmit` hook restates it briefly each turn so the style does not decay over a long session. `skills/plainspeak/SKILL.md` is the single source of truth — edit it and both hooks pick up the change.

Run the checks with `node test/test-hooks.js`.

## 한국어

개발자가 아닌데 클로드 코드로 직접 앱을 만드는 분들을 위한 플러그인입니다.

클로드는 기본적으로 코드를 읽을 사람에게 보고하듯 답합니다. 파일 경로, 함수 이름, 라이브러리, 코드 블록이 계속 나오는데 바이브코딩 하는 입장에서는 대부분 손댈 수 없는 정보입니다.

plainspeak를 켜면 답변이 이렇게 바뀝니다.

> 장바구니 담기 기능 붙였어요.
> 지금 브라우저에서 상품 담고 개수 바꾸는 것까지 됩니다.
> 확인하실 것: 화면에서 담기 눌러보고, 숫자가 맞게 오르는지만 봐주세요.

일하는 방식이 바뀌는 게 아니라 말하는 방식만 바뀝니다. 코드 품질과 검증은 그대로입니다.

설치는 위의 두 줄을 클로드 코드에 입력하고 재시작하면 끝이고, `/plainspeak lite|full|strict|off` 로 강도를 바꿉니다. 한번 고르면 다음 세션에도 유지됩니다.

말투는 따로 정할 수 있습니다. `/plainspeak setup` 을 치면 하나씩 물어보고, 쓰시는 언어에서 의미가 있는 것만 묻습니다. 말투(사무적·보통·친근), 존댓말이냐 반말이냐, 격려를 섞을지, 답변 길이, 목록과 소제목을 쓸지, 이모지를 쓸지, 문단을 나눌지입니다. 중간에 "나머지는 기본값으로" 라고 하면 거기서 끝납니다. `/plainspeak reset` 으로 언제든 원래 말투로 돌아갑니다.

직접 터미널에 치셔야 하는 명령어, 열어야 할 주소, 붙여넣어야 할 값은 어느 강도에서도 그대로 다 보여줍니다. 돈이 나가거나 되돌릴 수 없는 작업도 짧게 줄이지 않고 분명히 경고합니다. "코드 보여줘", "자세히 설명해줘" 라고 하시면 그때는 제한이 전부 풀립니다.

## License

MIT
