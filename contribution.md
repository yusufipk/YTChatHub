# Contribution Guide: Fixing TypeScript import.meta Error

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