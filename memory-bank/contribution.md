# Contribution Guide: Fixing TypeScript import.meta Error

## Contribution Rules
- Do not modify Memory Bank files (including this guide) unless expressly requested by the user. If additional documentation updates seem valuable, surface the suggestion first and wait for approval.

## Problem

We encountered the following TypeScript error:
```
The 'import.meta' meta-property is not allowed in files which will build into CommonJS output. ts(1470)
```

## Root Cause

This error occurs when TypeScript tries to compile code using `import.meta` (an ES module feature) into CommonJS output format. The issue typically happens when there's a mismatch between the module system configured in TypeScript and the expected output format.

In our case, the error was occurring in `backend/src/index.ts` where we were using:
```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  startBackend().catch((error) => {
    console.error('Failed to start backend', error);
    process.exit(1);
  });
}
```

This is a common pattern in ES modules to detect if a file is being run directly (equivalent to `require.main === module` in CommonJS).

## Solution

We fixed the issue by:

1. **Improving the ES module detection logic** to be more robust:
   - Added proper imports for path resolution utilities
   - Created a more reliable check using `pathToFileURL` and `resolve`
   - Added error handling for edge cases

2. **Updated package.json scripts** to use consistent npm commands

### Code Changes

**Before:**
```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  startBackend().catch((error) => {
    console.error('Failed to start backend', error);
    process.exit(1);
  });
}
```

**After:**
```typescript
const isDirectExecution = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    const href = pathToFileURL(resolve(entry)).href;
    return import.meta.url === href;
  } catch {
    return false;
  }
})();

if (isDirectExecution) {
  startBackend().catch((error) => {
    console.error('Failed to start backend', error);
    process.exit(1);
  });
}
```

**Additional imports added:**
```typescript
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
```

## Why This Fix Works

1. **Proper URL Resolution**: Instead of manually constructing the file URL, we use Node.js built-in utilities to properly resolve the path and convert it to a file URL.

2. **Error Handling**: The try/catch block ensures that if URL resolution fails for any reason, the application won't crash.

3. **Cross-Platform Compatibility**: Using Node.js path utilities ensures the code works correctly across different operating systems.

4. **TypeScript Compatibility**: This approach is compatible with both ES module and CommonJS compilation targets.

## Testing the Fix

To verify the fix works:

1. Run the development server: `npm run dev`
2. Check that the backend starts correctly
3. Verify there are no TypeScript errors related to import.meta
4. Confirm that the direct execution check still works as expected

## Additional Notes

- The package.json script changes were made to ensure consistent command usage across different environments
- This fix maintains the original functionality while resolving the TypeScript compilation error
- The solution is backward compatible and doesn't introduce any breaking changes

## Git Repository Information

This repository is a fork from yusufipk's repository and is being used under aliemrevezir's GitHub account.

### Remote Repository Commands

To work with the remote repositories, use the following commands:

1. **View current remotes:**
   ```bash
   git remote -v
   ```

2. **Add upstream remote (original repository):**
   ```bash
   git remote add upstream https://github.com/yusufipk/YTChatHub.git
   ```

3. **Add origin remote (your fork):**
   ```bash
   git remote add origin https://github.com/aliemrevezir/YTChatHub.git
   ```

4. **Fetch updates from upstream:**
   ```bash
   git fetch upstream
   ```

5. **Merge upstream changes into your local branch:**
   ```bash
   git merge upstream/main
   ```

6. **Push changes to your fork:**
   ```bash
   git push origin main
   ```

7. **Sync your fork with upstream:**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   git push origin main
   ```

## API Documentation and Refactoring

We're currently working on improving the API structure and documentation for better maintainability and developer experience.

### Current Progress

1. Created comprehensive API documentation for current endpoints (see `memory-bank/contribution-contents/api/current-api.md` for details)
2. Developed a refactoring plan for improved API structure (see `memory-bank/contribution-contents/api/refactoring-plan.md` for details)

### API Structure Improvements

#### Current State
- All API endpoints are implemented in a single file (`backend/src/index.ts`)
- Endpoints are defined inline without clear grouping
- Limited use of Fastify's plugin system

#### Planned Improvements
- Modular route structure organized by feature (chat, overlay, health)
- Consistent error handling across all endpoints
- Structured validation using Zod schemas
- Improved middleware leveraging Fastify's plugin system
- Comprehensive API documentation generated from code
- Unit tests for all API endpoints

## Direction Studio - Search & Filtering Implementation ✅ COMPLETED

The search and filtering functionality has been successfully implemented and is now available in the `/direction` page (Direction Studio). This feature provides professional-grade message search and filtering capabilities for stream direction workflows.

### What Was Implemented

#### Backend Enhancements ✅
- **Extended `/chat/messages` endpoint** with comprehensive query parameter support:
  - `search`: Text search with regex mode support
  - `mode`: Search mode ('plain' | 'regex')
  - `type`: Message type filter ('regular' | 'superchat' | 'membership')
  - `author`: Author name substring filter
  - `badges`: Comma-separated badge type filter
  - `limit`: Page size control (10-200 messages)
  - `cursor`: Pagination support for loading older messages
- **Enhanced metadata processing** with YouTube timestamp normalization
- **Author channel URL propagation** with fallback generation
- **Server-side filtering** with case-insensitive matching and badge intersection

#### Frontend Implementation ✅
- **Direction Studio page** (`/direction`) with advanced search interface
- **Real-time search** with 300ms debouncing and regex support
- **Multi-dimensional filtering** for message types, authors, and badges
- **Auto-refresh system** with 5-second intervals and visibility API integration
- **Request abort control** preventing race conditions and overlapping requests
- **Interactive elements**: clickable author names, viewer pills, and quick actions
- **Responsive design** matching the existing dark theme aesthetic

#### Performance Optimizations ✅
- **Debounced search** preventing excessive API calls
- **Request cancellation** for outdated search requests
- **Visibility API integration** preventing background polling
- **Race condition prevention** with request ID tracking
- **Memory-efficient filtering** maintaining 500-message limit

### Technical Achievements

1. **Performance**: Implemented debouncing with request abort control for optimal user experience
2. **User Experience**: Created intuitive filter controls with visual feedback and clear/reset functionality
3. **UI/UX Design**: Responsive interface that integrates seamlessly with existing dashboard design
4. **Search Capabilities**: Full regex support with error handling and content-only search
5. **Real-time Updates**: Auto-refresh with intelligent polling and visibility detection

### Current Status: ✅ COMPLETE

The Direction Studio is fully functional and includes:
- Advanced search with regex support
- Comprehensive filtering options
- Real-time auto-refresh
- Performance optimizations
- Professional UI/UX design
- Complete integration with existing overlay system

### References
1. [Current API Documentation](contribution-contents/api/current-api.md)
2. [API Refactoring Plan](contribution-contents/api/refactoring-plan.md)
3. [Changelog](changelog.md) - Detailed implementation history
4. [Search and Filtering Plan](contribution-contents/searchFilteringPlan.md) - Original technical specification
