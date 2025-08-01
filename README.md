# Diff Status Action

A GitHub Action that validates changed files against glob patterns and updates status checks accordingly.

## Usage

```yaml
name: Validate Changed Files
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: xeger/diff-status-action@v1
        with:
          globs: |
            **/*.md
            LICENSE
          statuses: |
            deploy-production
            deploy-staging
          token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

### `token`

**Required** The GitHub token used to authenticate API requests. Typically `${{ secrets.GITHUB_TOKEN }}`.

### `globs`

**Required** A newline-separated list of glob patterns to match against changed files. Each changed file must match at least one pattern.

### `statuses`

**Required** A newline-separated list of status check names to update. All statuses will be marked as successful if all files match the glob patterns.

## Outputs

None.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the action:
   ```bash
   npm run build
   ```

3. Run tests:
   ```bash
   npm test
   ```

## License

MIT
