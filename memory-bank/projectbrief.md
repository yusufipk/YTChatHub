# Project Brief

## Vision
Build a desktop-operated, open-source YouTube Live chat client that delivers a fast, reliable stream of messages and allows a streamer to spotlight a selected chat message on an OBS-ready overlay.

## Core Requirements
- Mirror chat from a single YouTube Live stream with low latency and high stability.
- Provide an operator dashboard to browse, search, and filter live chat messages.
- Enable one-click selection of a message and broadcast it to an overlay page consumable in OBS.
- Keep setup approachable: clone repo, configure environment variables/OAuth, and run locally.
- Prioritize performance and resilience over advanced user management or multi-stream support.

## Constraints
- Runs on the streamer’s personal computer; no external hosting assumed.
- No end-user authentication beyond stored YouTube OAuth credentials.
- Must tolerate YouTube API rate limits and intermittent network issues without crashing.

## Success Criteria
- Operator dashboard stays responsive during long streams (>4 hours) without memory leaks.
- Overlay updates within ~1 second of operator selection.
- Project documentation enables others to reproduce setup from scratch.
