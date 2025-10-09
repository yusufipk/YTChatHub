# API Documentation

This directory contains documentation and plans for the YTChatHub API.

## Contents

1. [Current API Documentation](current-api.md) - Documentation for the currently implemented API endpoints
2. [Refactoring Plan](refactoring-plan.md) - Comprehensive plan for refactoring the API structure
3. [Refactored Structure](refactored-structure.md) - Detailed description of the proposed refactored API structure

## Overview

The YTChatHub API provides endpoints for managing YouTube Live chat connections, retrieving messages, and controlling the OBS overlay. The API is built with Fastify and follows REST principles where applicable, with Server-Sent Events for real-time updates.

## Current Endpoints

- **Health Check**: `/health` (GET)
- **Chat Management**: `/chat/connect` (POST), `/chat/disconnect` (POST)
- **Message Retrieval**: `/chat/messages` (GET)
- **Overlay Control**: `/overlay/selection` (POST, DELETE), `/overlay/stream` (GET)

## Future Improvements

See the [Refactoring Plan](refactoring-plan.md) for details on planned improvements to the API structure, including:

- Modular route organization
- Consistent error handling
- Structured validation with Zod
- Improved middleware usage
- Comprehensive API documentation
- Unit test coverage

## Contributing

When making changes to the API:

1. Update the relevant documentation files
2. Follow the patterns established in the refactoring plan
3. Ensure backward compatibility during transitions
4. Add unit tests for new functionality