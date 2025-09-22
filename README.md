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
- See [Release Notes](https://github.com/actions/runner/releases/tag/v2.327.1) for more details

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

For more details, see the [full release notes](https://github.com/actions/setup-go/releases/tag/v6.0.0).

### V5 Changes

- **Upgraded Node.js runtime from node16 to node20**
- See [full release notes](https://github.com/actions/setup-go/releases) for complete details

## Version Resolution Behavior

The action follows this resolution order:
1. **Local cache** - Checks for a cached version match
2. **go-versions repository** - Pulls from the main branch of the [go-versions repository](https://github.com/actions/go-versions/blob/main/versions-manifest.json)
3. **Direct download** - Falls back to downloading directly from [go.dev](https://storage.googleapis.com/golang)

To change the default behavior, use the `check-latest` input.

> **Note**: The setup-go action uses executable binaries built by the Golang team. The action does not build Go from source code.

## Usage

### Basic Setup

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
      go-version: '^1.21.1' # The Go version to download (if necessary) and use.
  - run: go version
```

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '>=1.20.0'
  - run: go version
```

> **Important**: Due to YAML parsing behavior, always wrap version numbers in single quotes:
> ```yaml
> go-version: '1.20'  # Correct
> go-version: 1.20    # Incorrect - YAML parser interprets as 1.2
> ```

#### Pre-release Versions

```yaml
# RC version
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
       go-version: '1.22.0-rc.1' # The Go version to download (if necessary) and use
  - run: go version
```

```yaml
# Beta version
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.16.0-beta.1' # The Go version to download (if necessary) and use
  - run: go version
```

#### Version Aliases

**Stable Release**

If `stable` is provided, action will get the latest stable version from the go-versions repository manifest.
```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: 'stable' # Latest stable version
  - run: go version
```

**Previous Stable Release**

If `oldstable` is provided, when current release is 1.19.x, action will resolve version as 1.18.x, where x is the latest patch release.
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

The action will search for the `go.mod` file relative to the repository root:

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version-file: 'path/to/go.mod'
  - run: go version
```

### Check Latest Version

The check-latest flag defaults to false for stability. This ensures your workflow uses a specific, predictable Go version.
When check-latest: true: The action verifies if your cached Go version is the latest available. If not, it downloads and uses the newest version.

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

Caching is enabled by default. The action automatically caches and restores Go modules and build outputs using toolkit/cache with minimal configuration.

#### Automatic Caching

Default behavior: Searches for go.sum in the repository root and uses its hash for the cache key.

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.21'
      # cache: true (default)
  - run: go run hello.go
```

#### Advanced Caching Scenarios

For advanced scenarios, use `cache-dependency-path` to specify:
- **Multiple dependency files**: When your project has dependencies in different directories
- **Custom locations**: When your `go.sum` files are not in the repository root
- **Monorepos**: When managing multiple Go modules in a single repository
- **Glob patterns**: For flexible file matching

```yaml
# Example: Monorepo with multiple go.sum files
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.17'
      check-latest: true
      cache-dependency-path: |
        subdir/go.sum
        tools/go.sum
  - run: go run hello.go
```

```yaml
# Example: Using glob patterns to match all go.sum files
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.17'
      cache-dependency-path: "**/*.sum"
  - run: go run hello.go
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

> **Note**: If caching fails, the action logs a warning but continues execution without interrupting your workflow.

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

## Using setup-go on GHES

setup-go comes pre-installed on GHES when Actions is enabled. For dynamic Go version downloads, the action fetches distributions from actions/go-versions on github.com (external to your appliance).

These calls to `actions/go-versions` are made via unauthenticated requests, which are limited to 60 requests per hour per IP. If more requests are made within the time frame, then the action leverages the raw API to retrieve the version-manifest. This approach does not impose a rate limit and hence facilitates unrestricted consumption. This is particularly beneficial for GHES runners, which often share the same IP, to avoid the quick exhaustion of the unauthenticated rate limit. If that fails as well the action will try to download versions directly from [go.dev](https://storage.googleapis.com/golang).

If that fails as well you can get a higher rate limit with generating a personal access token on github.com and passing it as the token input to the action:

```yaml
uses: actions/setup-go@v6
with:
  token: ${{ secrets.GH_DOTCOM_TOKEN }}
  go-version: '1.18'
```

### Offline Runners

For runners without github.com access, Go versions must be pre-cached in the runner's tool cache. See "Setting up the tool cache on self-hosted runners without internet access".

## Recommended Permissions

When using the setup-go action in your GitHub Actions workflow, it is recommended to set the following permissions to ensure proper functionality:

```yaml
permissions:
  contents: read # Required to checkout code and install dependencies
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

## Contributions

Contributions are welcome! See our [Contributor's Guide](docs/contributors.md) for details.

## Code of Conduct

👋 Be nice. See our [Code of Conduct](CODE_OF_CONDUCT.md).