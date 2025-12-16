# Deployment Configuration

## Test Requirements

The application is configured to **require all tests to pass** before deployment can complete on Vercel.

### How It Works

1. **Prebuild Hook**: The `prebuild` script in `package.json` automatically runs before the build
2. **Test Execution**: Tests run with CI-friendly settings:
   - `--ci` flag: Optimized for continuous integration
   - `--maxWorkers=2`: Limits parallel workers for CI environments
   - Note: Coverage is not enforced during build (run `test:coverage` separately)
3. **Build Failure**: If any test fails, the build process stops and Vercel deployment is cancelled

### Test Configuration

Tests are configured with:
- **Coverage Thresholds**: Minimum 60% coverage required
- **CI Mode**: Optimized for automated environments
- **Error Handling**: Tests fail on deprecated APIs

### Running Tests Locally

```bash
# Run all tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Vercel Build Process

When deploying to Vercel:

1. **Install**: `npm install` runs first
2. **Prebuild**: `npm run prebuild` runs automatically (executes tests)
3. **Build**: `npm run build` runs only if tests pass
4. **Deploy**: Application deploys only if build succeeds

### Bypassing Tests (Not Recommended)

If you need to bypass tests (not recommended for production):

1. Temporarily remove or comment out the `prebuild` script
2. Or modify the build command in Vercel dashboard to skip tests

**Warning**: Bypassing tests can lead to deploying broken code to production.

### GitHub Actions

A GitHub Actions workflow is also configured (`.github/workflows/test.yml`) to:
- Run tests on push and pull requests
- Upload coverage reports to Codecov (optional)
- Provide early feedback before deployment

### Troubleshooting

#### Tests Fail in CI but Pass Locally

- Check Node.js version compatibility
- Ensure all environment variables are set in Vercel
- Verify test database/API mocks are working correctly

#### Build Times Out

- Tests may be taking too long
- Consider reducing `--maxWorkers` or optimizing slow tests
- Check Vercel build logs for specific timeout errors

#### Coverage Threshold Not Met

- Add more tests to increase coverage
- Or temporarily lower thresholds (not recommended)
- Focus on critical paths first

### Best Practices

1. **Always run tests locally** before pushing
2. **Fix failing tests immediately** - don't bypass
3. **Keep coverage above thresholds** - add tests for new features
4. **Review test failures** in Vercel build logs
5. **Use test:watch** during development for faster feedback

