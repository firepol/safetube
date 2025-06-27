# Testing Rules

- Keep tests close to the code they test (see [*.test.ts, *.test.tsx](mdc:src)).
- Use descriptive test names in all test files.
- Write tests for all new features and bug fixes before committing.
- Test both success and error cases.
- Mock external dependencies and side effects.
- Follow the Arrange-Act-Assert pattern in tests.
- Ensure test coverage for critical paths.
- Always run tests (`yarn test`) before asking the user to check anything.
- If tests fail, fix the issues before proceeding.
- When making changes that affect multiple components or files, run tests after each significant change.
- If you're unsure about a change's impact, run the tests to verify.
- Never ask the user to run tests without having run them yourself first.
- If you encounter test failures, document them and fix them before proceeding with the next steps.
- When moving or refactoring code, ensure all tests pass before committing changes.

## Server Management Requirements
- **CRITICAL**: Always kill any running development servers after running tests or development commands
- Use `yarn killserver:linux` (Linux) or `yarn killserver:mac` (macOS) to ensure clean server shutdown
- Before running `yarn electron:dev`, always check for and kill any existing servers on port 5173
- If you run `yarn test:watch` or `yarn test:ui`, ensure you properly terminate the process (Ctrl+C) before ending your session
- Never leave development servers running in the background

## Test Requirements for New Features
- Unit tests for individual components and functions
- Integration tests for feature interactions
- Error handling and edge cases
- Performance considerations where relevant

## Test Requirements for Bug Fixes
- Test that reproduces the bug
- Test that verifies the fix
- Additional tests for related edge cases
- Regression tests to prevent future issues

## Development Workflow
1. Make changes to code
2. Write or update tests for the changes
3. Run tests with `yarn test`
4. **Kill any running servers with appropriate kill script**
5. If tests pass, commit changes
6. If tests fail, fix issues before committing

## Test Naming Conventions
- Use descriptive names that explain the test's purpose
- Follow the pattern: `describe('Component/Function', () => { it('should do something specific', () => {}) })`
- Group related tests using nested `describe` blocks
- Use `beforeEach` and `afterEach` for test setup and cleanup

## Test Organization
- Keep test files next to the code they test
- Use `.test.ts` or `.test.tsx` extension
- Group related tests together
- Use clear test descriptions
- Follow the AAA pattern (Arrange, Act, Assert) 