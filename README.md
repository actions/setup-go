# Setup Go Action

[![Basic validation](https://github.com/actions/setup-go/actions/workflows/basic-validation.yml/badge.svg)](https://github.com/actions/setup-go/actions/workflows/basic-validation.yml)
[![Validate 'setup-go'](https://github.com/actions/setup-go/actions/workflows/versions.yml/badge.svg)](https://github.com/actions/setup-go/actions/workflows/versions.yml)

This action sets up a Go environment for use in GitHub Actions by:
- Optionally downloading and caching a version of Go by version and adding to PATH
- Registering problem matchers for error output
- Providing intelligent caching for Go modules and build outputs

## Quick Start

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.21'
  - run: go version
```

## Breaking Changes

### V6 Changes

#### Node Runtime Upgrade
- **Upgraded from Node 20 to Node 24**
- ⚠️ **Action Required**: Ensure your runner is on version v2.327.1 or later for compatibility
- See [Release Notes](https://github.com/actions/runner/releases) for more details

#### Enhanced Go Toolchain Management

V6 introduces significant improvements for reliable and consistent Go version selection:

**Toolchain Directive Support**
Now correctly interprets both `go` and `toolchain` directives from `go.mod`:
```go
go 1.21.0           // Minimum required version
toolchain go1.21.6  // V6 uses this exact version
```

**Advanced Version Resolution**
Supports comprehensive version patterns:
- Comparison operators: `>=1.21.0`, `<1.22.0`
- Semantic versioning: `~1.21.0` (patch updates), `^1.21.0` (minor updates)
- Wildcards: `1.21.x`, `1.*`

**Intelligent Caching**
Cache keys now incorporate toolchain-specific metadata, eliminating version conflicts when switching between Go versions in your workflows.

**Migration Impact**
These changes ensure your workflows use the exact Go version your project requires, improving build reproducibility and reducing version-related issues.

For more details, see the [full release notes](https://github.com/actions/setup-go/releases).

### V5 Changes

- Upgraded Node.js runtime from node16 to node20
- See [full release notes](https://github.com/actions/setup-go/releases) for complete details

## Version Resolution Behavior

The action follows this resolution order:
1. **Local cache** - Checks for a cached version match
2. **go-versions repository** - Pulls from the main branch of the [go-versions repository](https://github.com/actions/go-versions)
3. **Direct download** - Falls back to downloading directly from [go.dev](https://go.dev/dl/)

To change the default behavior, use the `check-latest` input.

> **Note**: The setup-go action uses executable binaries built by the Golang team. The action does not build Go from source code.

## Usage Examples

### Basic Usage

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.21'
  - run: go run hello.go
```

### Version Specifications

#### Semantic Versioning

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '^1.21.1' # Latest patch release of 1.21.x
  - run: go version
```

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '>=1.20.0' # Version 1.20.0 or higher
  - run: go version
```

> **Important**: Due to YAML parsing behavior, always wrap version numbers in single quotes:
> ```yaml
> go-version: '1.20'  # Correct
> go-version: 1.20    # Incorrect - YAML parser interprets as 1.2
> ```

#### Pre-release Versions

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.22.0-rc.1'
  - run: go version
```

#### Version Aliases

**Stable Release**
```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: 'stable' # Latest stable version
  - run: go version
```

**Previous Stable Release**
```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: 'oldstable' # Previous stable version
  - run: go version
```

> **Note**: Using aliases is equivalent to using the corresponding minor release with `check-latest: true`

### Version from go.mod File

The action can automatically detect the Go version from your project's `go.mod` or `go.work` file:

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version-file: 'go.mod'
  - run: go version
```

**Version Resolution from go.mod:**
1. Uses the `toolchain` directive version if present
2. Falls back to the `go` directive version
3. If no patch version is specified, uses the latest available patch

> **Note**: If both `go-version` and `go-version-file` are provided, `go-version` takes precedence.

### Check Latest Version

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.21'
      check-latest: true # Always check for the latest patch release
  - run: go version
```

**Performance Considerations:**
- `check-latest: false` (default) - Uses cached versions for faster builds
- `check-latest: true` - Downloads the latest version, slower but ensures up-to-date releases

### Caching

#### Automatic Caching

Caching is enabled by default and automatically handles:
- Go modules (based on `go.sum`)
- Build outputs
- Toolchain-specific metadata

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.21'
      # cache: true (default)
  - run: go run hello.go
```

#### Custom Cache Dependencies

For projects with multiple dependency files or monorepos:

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.21'
      cache-dependency-path: |
        subdir/go.sum
        tools/go.sum
  - run: go run hello.go
```

**Using Glob Patterns:**
```yaml
cache-dependency-path: "**/*.sum"
```

#### Disable Caching

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.21'
      cache: false
  - run: go run hello.go
```

### Matrix Testing

Test across multiple Go versions:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        go-version: ['1.20', '1.21', '1.22']
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-go@v6
        with:
          go-version: ${{ matrix.go-version }}
      - run: go test ./...
```

## Advanced Configuration

### Supported Version Syntax

| Syntax Type | Example | Description |
|-------------|---------|-------------|
| Specific version | `1.21.5` | Exact version |
| Semantic range | `^1.21.0` | Compatible with 1.21.0 |
| Comparison operators | `>=1.20.0` | Version 1.20.0 or higher |
| Wildcards | `1.21.x` | Latest patch of 1.21 |
| Pre-release | `1.22.0-rc.1` | Release candidate |
| Aliases | `stable`, `oldstable` | Latest stable versions |

For more information about semantic versioning, see the [semver documentation](https://semver.org/).

### Complete Input Reference

```yaml
- uses: actions/setup-go@v6
  with:
    # Version or version range of Go to use
    go-version: '1.21'
    
    # Path to go.mod or go.work file
    go-version-file: 'go.mod'
    
    # Check for latest version
    check-latest: false
    
    # GitHub token for authentication
    token: ${{ github.token }}
    
    # Enable/disable caching
    cache: true
    
    # Path to dependency files for caching
    cache-dependency-path: 'go.sum'
    
    # Architecture to install (auto-detected if not specified)
    architecture: 'x64'
```

## Platform Support

### GitHub Enterprise Server (GHES)

When using setup-go on GHES:

1. **Pre-installed**: The action comes pre-installed if Actions is enabled
2. **Rate limits**: Unauthenticated requests are limited to 60/hour per IP
3. **Authentication**: Use a personal access token for higher rate limits:

```yaml
- uses: actions/setup-go@v6
  with:
    token: ${{ secrets.GH_DOTCOM_TOKEN }}
    go-version: '1.21'
```

4. **Offline runners**: For runners without internet access, see [Setting up the tool cache on self-hosted runners](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners#using-self-hosted-runners-in-a-workflow)

### Self-hosted Runners

For self-hosted runners without internet access, ensure Go versions are pre-cached in the runner's tool cache.

## Recommended Permissions

```yaml
permissions:
  contents: read # Required to checkout code and install dependencies
```

## Troubleshooting

### Common Issues

**Version not found**
- Ensure the version exists in the [Go releases](https://go.dev/dl/)
- Check if you're using the correct version format
- Try using `check-latest: true`

**Caching issues**
- Cache conflicts may occur when switching Go versions
- V6 resolves this with toolchain-specific cache keys
- Manually clear cache if needed using GitHub Actions cache management

**YAML parsing**
- Always wrap version numbers in single quotes
- Avoid bare numbers that YAML might misinterpret

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

## Contributions

Contributions are welcome! See our [Contributor's Guide](docs/contributors.md) for details.

## Code of Conduct

👋 Be nice. See our [Code of Conduct](CODE_OF_CONDUCT.md).