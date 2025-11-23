# Comment System Test Suite

This directory contains comprehensive unit and integration tests for the comment system functionality added to the Ampere Business Management application.

## Test Coverage

### 1. Core Functionality Tests (`comments.test.tsx`)
Tests the core library functions and React component rendering:

- **Mention Parsing**: Token regex matching, extraction, and markup conversion
- **Schema Validation**: Zod schema validation for mentions, comments, updates, and deletes
- **Authorization Logic**: Permission checks for comment modification
- **Entity Key Mapping**: Correct mapping of entity types to database keys
- **Component Rendering**: React component SSR rendering with various props
- **Edge Cases**: Unicode, special characters, empty states, consecutive mentions

**Test Count**: 70+ tests

### 2. API Handler Tests (`api-handlers.test.ts`)
Tests the business logic in API route handlers:

- **Entity Type Mapping**: Verification of all entity type mappings
- **Input Validation**: Request payload validation and sanitization
- **Authorization**: Role-based access control and ownership checks
- **Mention Processing**: Deduplication and normalization of mentions
- **User Search**: Query parameter handling and result mapping
- **Route Delegation**: Verification of route-to-handler mapping

**Test Count**: 25+ tests

### 3. Schema Validation Tests (`schema-validation.test.ts`)
Comprehensive Zod schema validation tests:

- **Mention Schema**: ID requirements, optional fields, email validation
- **Comment Input Schema**: Content trimming, mention arrays, unicode support
- **Comment Update Schema**: Required fields, content validation
- **Comment Delete Schema**: ID validation and type checking
- **Edge Cases**: Very long content, special characters, whitespace handling
- **Cross-schema Consistency**: Behavior consistency across schemas

**Test Count**: 60+ tests

## Running Tests

### Run All Tests
```bash
npm run test:all
# or
yarn test:all
```

### Run Specific Test Suites
```bash
# Core functionality tests
npm run test:comments

# API handler tests
npm run test:api

# Schema validation tests
npm run test:schema

# Original test script (runs core tests)
npm test
```

## Test Framework

The test suite uses:
- **Node.js `assert` module**: For assertions
- **tsx**: For TypeScript execution
- **React Server Components**: For component rendering tests
- **Custom test runner**: Lightweight test discovery and execution

No external testing frameworks (Jest, Mocha, etc.) are required.

## Writing New Tests

To add new tests, follow this pattern:

```typescript
// @ts-nocheck
import assert from "assert"

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  tests.push({ name, run })
}

test("description of what is being tested", () => {
  const result = functionUnderTest(input)
  assert.strictEqual(result, expectedValue)
})

// Run all tests
tests.forEach(({ name, run }) => {
  try {
    run()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
})
```

## Test Coverage Areas

### Pure Functions ✅
- `extractMentions()` - Mention token parsing
- `ensureMentionMarkup()` - Markup conversion
- `canModifyComment()` - Authorization logic
- `getCommentEntityKey()` - Entity type mapping

### Validation Schemas ✅
- `mentionSchema` - Mention object validation
- `commentInputSchema` - Comment creation validation
- `commentUpdateSchema` - Comment update validation
- `commentDeleteSchema` - Comment deletion validation

### Components ✅
- `CommentThread` - Full component rendering
- Initial state rendering
- Comment display
- User avatars and badges
- Mention rendering

### API Logic ✅
- Request validation
- Authorization checks
- Entity existence verification
- Mention deduplication
- Response mapping

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm run test:all
```

## Test Maintenance

When adding new features:
1. Add corresponding test cases to appropriate test file
2. Ensure edge cases are covered
3. Test both happy paths and error conditions
4. Update this README if new test categories are added

## Known Limitations

- Tests do not interact with actual database (Prisma mocked)
- Tests do not make real HTTP requests
- Session/authentication is simulated in tests
- Focus is on pure function logic and validation

## Test Results

All tests should pass before merging changes. Current status:

- ✅ Core Functionality Tests
- ✅ API Handler Tests
- ✅ Schema Validation Tests

**Total**: 155+ test cases covering the comment system