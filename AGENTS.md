# AGENTS.md

Guidance for AI coding agents working in this repository. Humans are welcome to read it too.

## What this project is

**Becoming Many** is a speculative VR experience about layered, non-human perception — see
[README.md](README.md) for the concept. This repository is a clean-slate rewrite; the previous
implementation is not carried over. Treat any decision here as fresh unless it is written down
in this file.

## Language rule

**Everything in this repository is written in English.** That covers code, identifiers, type
names, file and directory names, comments, commit messages, documentation, log output, and
UI-facing strings unless a string is deliberately part of the German-language experience content
(voiceover text, on-screen copy for the audience).

This holds regardless of the language of the conversation. If the chat is in German, the answer
may be in German — the artifacts that land in the repo are still English. Do not translate
identifiers or comments to match the language of the request.

## Working agreements

- **Ask before assuming.** The project's design decisions are not all in the repo yet. If a task
  depends on an unwritten decision, ask rather than inventing one and burying it in code.
- **Finish what you start.** Leave the repo in a state where the gates pass. If you cannot
  finish, say what is unfinished rather than leaving it silently broken.
- **Small, self-contained modules.** Modules communicate through typed data structures and
  explicit interfaces, never through shared globals.
- **Write down decisions.** Anything a future agent would otherwise have to guess belongs in
  this file or in `docs/`, not only in a commit message.
- **Do not commit or push unless asked.**

## Repository conventions

- Documentation lives in `docs/`; this file stays short and points there.
- `README.md` describes the piece for a reader who has never seen it. Keep the vision text and
  the implementation notes separate.

## Toolchain

Not yet established — this repo is empty by design. When the stack lands, record here: package
manager, dev/build/test commands, the quality gates that must pass before code counts as done,
and the rendering rules. Until then, do not assume the previous project's setup still applies.
