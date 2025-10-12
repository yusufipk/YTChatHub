# YouTube Live Chat Client (WIP)

Build a desktop-operated, open-source YouTube Live chat client that delivers a fast, reliable stream of messages and allows a streamer to spotlight a selected chat message on an OBS-ready overlay.

Currently work in progress bugs might be there.

## Key Features

- **High-Performance Chat**: A sleek, minimal dashboard for monitoring YouTube Live chat in real-time.
- **OBS Integration**: Select any message to instantly display it on an OBS-ready overlay.
- **Rich Message Support**: Full support for Super Chats, gifted memberships, and user badges.
- **Compact and Efficient**: A dark, minimalist UI designed to be space-efficient and easy on the eyes.
- **Intelligent Auto-Scroll**: The chat automatically scrolls to new messages but stops when you scroll up to read previous messages.

## Getting Started

Follow these instructions to set up the project for local development.

### Prerequisites

- [Node.js](https://nodejs.org/) (v20.x or later)
- [pnpm](https://pnpm.io/)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/yusufipk/YTChatHub
    cd YTChatHub
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

### Running the Application

To start the development server for both the backend and frontend, run:

```bash
pnpm dev
```

- The dashboard will be available at `http://localhost:3000/dashboard`.
- The OBS overlay will be available at `http://localhost:3000/overlay`.

## Technology Stack

- **Frontend**: [Next.js](https://nextjs.org/) (React)
- **Backend**: [Node.js](https://nodejs.org/) with [Fastify](https://www.fastify.io/) and [tsx](https://github.com/esbuild-kit/tsx)
- **YouTube Integration**: [youtubei.js](https://github.com/LuanRT/YouTube.js)
- **Styling**: Handcrafted CSS
