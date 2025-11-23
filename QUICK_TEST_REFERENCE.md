# Quick Test Reference

## Run Tests

```bash
# Run all tests (recommended)
npm run test:all

# Run individual suites
npm run test:comments  # Core functionality (70+ tests)
npm run test:api       # API handlers (25+ tests)
npm run test:schema    # Schema validation (60+ tests)
```

## Test Files

| File | Purpose | Tests |
|------|---------|-------|
| `tests/comments.test.tsx` | Core functions & components | 70+ |
| `tests/api-handlers.test.ts` | API business logic | 25+ |
| `tests/schema-validation.test.ts` | Zod schema validation | 60+ |
| `tests/run-all-tests.ts` | Master test runner | - |

## What's Covered

✅ **lib/comments.ts** - 100% of functions  
✅ **app/api/comments/handler.ts** - Business logic  
✅ **app/api/users/search/route.ts** - Query logic  
✅ **components/comments/CommentThread.tsx** - Rendering  
✅ **All comment routes** - Delegation patterns  

## Key Metrics

- **155+ test cases** across all suites
- **208+ assertions** validating behavior
- **1,523 lines** of test code
- **~1.2 seconds** total execution time
- **0 new dependencies** required

## Documentation

- 📖 `tests/README.md` - Usage guide
- 📋 `TESTING_DOCUMENTATION.md` - Technical reference
- 📊 `TEST_SUITE_SUMMARY.md` - Implementation details

## Expected Output