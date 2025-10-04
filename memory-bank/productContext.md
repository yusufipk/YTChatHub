# Product Context

## Why This Project Exists
Live streamers rely on YouTube’s default chat panel, which can feel sluggish, cluttered, and unreliable during high-traffic moments. Streamers also need a smoother workflow to feature chat messages inside OBS without manual copy/paste or third-party widgets.

## Target Users
- Primary: Single YouTube streamer operating their own broadcast setup.
- Secondary: Community contributors who want to customize or extend the client for similar use cases.

## User Goals
- Launch the app locally and connect to their live chat with minimal configuration.
- View chat in a fast, filterable interface that highlights new messages clearly.
- Select a message to instantly display in an overlay browser source within OBS.
- Trust that the app will keep running throughout long streams without desync or crashes.

## Experience Principles
- **Performance First:** Avoid lag by batching updates, minimizing re-renders, and offloading work to background processes.
- **Operational Clarity:** Provide clear status indicators for connection health, rate limits, and overlay sync.
- **Low Friction:** Onboarding should consist of OAuth login once and a simple start command.
- **Extensible:** Keep architecture modular so advanced users can add features (moderation tools, multi-stream support) later.
