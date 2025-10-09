# YouTube Live Chat Client (WIP)

Build a desktop-operated, open-source YouTube Live chat client that delivers a fast, reliable stream of messages and allows a streamer to spotlight a selected chat message on an OBS-ready overlay.

Currently work in progress - bugs might be present.

## Key Features

- **High-Performance Chat**: A sleek, minimal dashboard for monitoring YouTube Live chat in real-time with intelligent auto-scroll that stops when you scroll up to read previous messages.
- **OBS Integration**: Select any message to instantly display it on an OBS-ready overlay with transparent background for seamless integration.
- **Rich Message Support**: Full support for Super Chats, gifted memberships, user badges (moderator, member, verified), and custom emojis.
- **Compact and Efficient**: A dark, minimalist UI designed to be space-efficient and easy on the eyes with a modern glass-morphism design.
- **Flexible Connection**: Connect to any YouTube Live stream using either the stream ID or full URL.

## Project Structure

```
.
├── backend/              # Node.js backend service
│   ├── src/
│   │   ├── ingestion/    # YouTube chat ingestion via youtubei.js
│   │   │   └── youtubei.ts
│   │   └── index.ts      # Main backend entry point
│   └── tsconfig.json
├── client/               # Next.js frontend application
│   ├── app/
│   │   ├── dashboard/    # Operator dashboard for monitoring chat
│   │   │   └── page.tsx
│   │   ├── overlay/      # OBS-ready overlay page
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── next.config.js
├── shared/               # Shared TypeScript definitions
│   └── chat.ts
├── memory-bank/          # Project documentation and context
└── package.json          # Project dependencies and scripts
```

## Getting Started

Follow these instructions to set up the project for local development.

### Prerequisites

- [Node.js](https://nodejs.org/) (v20.x or later)
- [pnpm](https://pnpm.io/)

### Installation

1. **Clone the repository:**

    ```bash
    git clone https://github.com/aliemrevezir/YTChatHub.git
    cd YTChatHub
    ```

2. **Install dependencies:**

    ```bash
    pnpm install
    ```

3. **Configure environment variables:**

    Copy the example environment file and fill in your YouTube Live stream ID:

    ```bash
    cp .env.example .env.local
    ```

    Edit `.env.local` and add your YouTube Live stream ID:

    ```
    YOUTUBE_LIVE_ID=your_youtube_live_stream_id
    ```

    You can use either a full YouTube URL or just the video ID.

### Running the Application

To start the development server for both the backend and frontend, run:

```bash
pnpm dev
```

This command will start both services concurrently:
- The backend API will be available at `http://localhost:4100`
- The dashboard will be available at `http://localhost:3000/dashboard`
- The OBS overlay will be available at `http://localhost:3000/overlay`

## Usage

1. **Access the Dashboard**: Navigate to `http://localhost:3000/dashboard` in your browser
2. **Connect to a Stream**: If you haven't set `YOUTUBE_LIVE_ID` in your environment, you'll see a connection prompt where you can enter a YouTube Live stream ID or URL
3. **Monitor Chat**: View incoming chat messages in real-time across three panels:
   - Regular chat messages
   - Super Chats (paid messages)
   - Memberships and milestones
4. **Feature Messages**: Click on any message to spotlight it on the OBS overlay
5. **OBS Integration**: Add `http://localhost:3000/overlay` as a browser source in OBS to display selected messages

## Technology Stack

- **Frontend**: [Next.js](https://nextjs.org/) (React 19 with App Router) + TypeScript
- **Backend**: [Node.js](https://nodejs.org/) with [Fastify](https://www.fastify.io/) and [tsx](https://github.com/esbuild-kit/tsx)
- **YouTube Integration**: [youtubei.js](https://github.com/LuanRT/YouTube.js) for Innertube API access
- **Real-time Communication**: Server-Sent Events (SSE) for overlay updates
- **Styling**: Handcrafted CSS with modern design principles
- **State Management**: React hooks and event emitters
- **Build Tools**: TypeScript, pnpm

## API Endpoints

### Backend API (`http://localhost:4100`)

- `GET /health` - Check backend status and connection info
- `POST /chat/connect` - Connect to a YouTube Live stream
- `POST /chat/disconnect` - Disconnect from current stream
- `GET /chat/messages` - Retrieve chat messages
- `POST /overlay/selection` - Select a message for the overlay
- `DELETE /overlay/selection` - Clear the current overlay selection
- `GET /overlay/stream` - Server-Sent Events stream for overlay updates

## Development

### Project Commands

- `pnpm dev` - Start both backend and frontend in development mode
- `pnpm dev:backend` - Start only the backend service
- `pnpm dev:client` - Start only the frontend client
- `pnpm build` - Build both backend and frontend for production
- `pnpm build:backend` - Build only the backend service
- `pnpm build:client` - Build only the frontend client
- `pnpm start:backend` - Start the built backend service
- `pnpm start:client` - Start the built frontend client

### Architecture

The project follows a monorepo structure with clear separation of concerns:

1. **Backend Service**: 
   - Connects to YouTube Live chat via youtubei.js
   - Maintains in-memory storage of recent messages (up to 500)
   - Exposes REST API for dashboard communication
   - Provides SSE stream for overlay updates
   - Handles connection management and error recovery

2. **Frontend Client**:
   - Dashboard for monitoring and selecting messages
   - Overlay page for OBS integration
   - Real-time updates via polling and SSE
   - Responsive design with dark theme

3. **Shared Types**:
   - Common TypeScript definitions for chat messages
   - Ensures type consistency between backend and frontend

## Contributing

Contributions are welcome! Please read our [Contribution Guide](memory-bank/contribution.md) for details on our development process and how to propose improvements.

## Roadmap

See our [Progress Tracker](memory-bank/progress.md) for current development status and upcoming features:
- Search and filtering functionality for chat messages
- Enhanced error recovery and reconnection logic
- Keyboard shortcuts for quick message selection
- Entrance/exit animations for overlay message transitions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
