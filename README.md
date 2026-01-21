# setup-go

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
      go-version: '1.23'
  - run: go version
```

## Breaking Changes

### V6 Changes

**Node Runtime Upgrade**
- **Upgraded from Node 20 to Node 24**
- ⚠️ **Action Required**: Ensure your runner is on version v2.327.1 or later for compatibility
- See [Release Notes](https://github.com/actions/runner/releases/tag/v2.327.1) for more details

**Enhanced Go Toolchain Management**

V6 introduces significant improvements for reliable and consistent Go version selection. Supports both `go` and `toolchain` directives in `go.mod`. If the `toolchain` directive is present, its version is used; otherwise, the action falls back to the go directive.
   
**Cache Key Update**

By default, caching for Go modules now relies on `go.mod`. To use `go.sum`, configure the `cache-dependency-path` input.

For more details, see the [full release notes](https://github.com/actions/setup-go/releases/tag/v6.0.0).

### V5 Changes

- **Upgraded Node.js runtime from node16 to node20**
- See [full release notes](https://github.com/actions/setup-go/releases) for complete details

## Version Resolution Behavior

The action follows this resolution order:
1. **Local cache** - Checks for a cached version match
2. **go-versions repository** - Pulls from the main branch of the [go-versions repository](https://github.com/actions/go-versions/blob/main/versions-manifest.json)
3. **Direct download** - Falls back to downloading directly from [go.dev](https://go.dev/dl)

To change the default behavior, use the `check-latest` input.

> **Note**: The setup-go action uses executable binaries built by the Golang team. The action does not build golang from source code.

## Usage

### Basic Setup

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.23'
  - run: go run hello.go
```

### Version Specifications

#### Semantic Versioning

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '^1.23.1' # The Go version to download (if necessary) and use.
  - run: go version
```

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '>=1.22.0'
  - run: go version
```

> **Important**: Due to YAML parsing behavior, always wrap version numbers in single quotes:
> ```yaml
> go-version: '1.22'  # Correct
> go-version: 1.22    # Incorrect - YAML parser interprets as 1.2
> ```

#### Pre-release Versions

```yaml
# RC version
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
       go-version: '1.24.0-rc.1' # The Go version to download (if necessary) and use
  - run: go version
```

```yaml
# Beta version
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.23.0-beta.1' # The Go version to download (if necessary) and use
  - run: go version
```

#### Version Aliases

**Stable Release**

If `stable` is provided, action will get the latest stable version from the [go-versions](https://github.com/actions/go-versions/blob/main/versions-manifest.json) repository manifest.
```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: 'stable' # Latest stable version
  - run: go version
```

**Previous Stable Release**

If `oldstable` is provided, when the current release is 1.23.x, the action will resolve version as 1.22.x, where x is the latest patch release.
```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: 'oldstable' # Previous stable version
  - run: go version
```

> **Note**: Using aliases is equivalent to using the corresponding minor release with `check-latest: true`

### go-version-file

The action can automatically detect the Go version from various project files using the `go-version-file` input. This parameter supports `go.mod`, `go.work`, `.go-version`, and `.tool-versions` files.

> **Note**: If both `go-version` and `go-version-file` are provided, `go-version` takes precedence.

#### go.mod File

Automatically detect the Go version from your project's `go.mod` file:

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

#### go.work File

Use the Go version specified in your `go.work` file:

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version-file: 'go.work'
  - run: go version
```

#### .go-version File

Read the Go version from a `.go-version` file:

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version-file: '.go-version'
  - run: go version
```

#### .tool-versions File

Use the Go version from an [`.tool-versions`](https://asdf-vm.com/manage/configuration.html#tool-versions) file:

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version-file: '.tool-versions'
  - run: go version
```

#### Custom File Paths

The action searches for version files relative to the repository root by default. You can specify a custom path:

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version-file: 'path/to/.go-version'
  - run: go version
```

**Supported Version Formats:**
- Major and minor only: `1.25` (action will use the latest patch version, e.g., `1.25.4`)
- Major, minor, and patch: `1.25.4` (exact version)

### Check Latest Version

The check-latest flag defaults to false for stability. This ensures your workflow uses a specific, predictable Go version.
When `check-latest: true`, the action verifies if your cached Go version is the latest available. If not, it downloads and uses the newest version.

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.23'
      check-latest: true # Always check for the latest patch release
  - run: go version
```

**Performance Considerations:**
- `check-latest: false` (default) - Uses cached versions for faster builds
- `check-latest: true` - Downloads the latest version, slower but ensures up-to-date releases

### Caching

The action features integrated caching for Go modules and build outputs. Built on [toolkit/cache](https://github.com/actions/toolkit/tree/main/packages/cache), it simplifies the caching process by requiring fewer configuration options. The cache input is optional, and caching is turned on by default.

#### Automatic Caching

Default behavior: Searches for `go.mod` in the repository root and uses its hash for the cache key.

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.23'
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
      go-version: '1.23'
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
      go-version: '1.23'
      cache-dependency-path: "**/*.sum"
  - run: go run hello.go
```

#### Disable Caching

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.23'
      cache: false
  - run: go run hello.go
```

> **Note**: If caching fails, the action logs a warning but continues execution without interrupting your workflow.

**Restore-Only Cache**

```yaml
# In some workflows, you may want to restore a cache without saving it. This can help reduce cache writes and storage usage in workflows that only need to read from cache
jobs:
    build:
      runs-on: ${{ matrix.os }}
      strategy:
        matrix:
          os: [ubuntu-latest, macos-latest, windows-latest]
      steps:
        - uses: actions/checkout@v6
        - name: Setup Go
          id: setup-go
          uses: actions/setup-go@v6
          with:
            go-version: '1.24.10'
            cache: false
        # Capture Go cache locations
        - name: Set Go cache variables (Linux/macOS)
          if: runner.os != 'Windows'
          run: |
            echo "GO_MOD_CACHE=$(go env GOMODCACHE)" >> $GITHUB_ENV
            echo "GO_BUILD_CACHE=$(go env GOCACHE)" >> $GITHUB_ENV
        - name: Set Go cache variables (Windows)
          if: runner.os == 'Windows'
          shell: pwsh
          run: |
            echo "GO_MOD_CACHE=$(go env GOMODCACHE)" | Out-File $env:GITHUB_ENV -Append
            echo "GO_BUILD_CACHE=$(go env GOCACHE)"   | Out-File $env:GITHUB_ENV -Append
        # Normalize runner.arch to lowercase to ensure consistent cache keys
        - name: Normalize runner architecture (Linux/macOS)
          if: runner.os != 'Windows'
          shell: bash
          run: echo "ARCH=$(echo '${{ runner.arch }}' | tr '[:upper:]' '[:lower:]')" >> $GITHUB_ENV
        - name: Normalize runner architecture (Windows)
          if: runner.os == 'Windows'
          shell: pwsh
          run: |
            $arch = "${{ runner.arch }}".ToLower()
            echo "ARCH=$arch" | Out-File $env:GITHUB_ENV -Append
        - name: Set cache OS suffix for Linux
          if: runner.os == 'Linux'
          shell: bash
          run: echo "CACHE_OS_SUFFIX=$ImageOS-" >> $GITHUB_ENV    
        - name: Restore Go cache
          id: go-cache
          uses: actions/cache/restore@v5
          with:
            path: |
              ${{ env.GO_MOD_CACHE }}
              ${{ env.GO_BUILD_CACHE }}
            key: setup-go-${{ runner.os }}-${{ env.ARCH }}-${{ env.CACHE_OS_SUFFIX }}go-${{ steps.setup-go.outputs.go-version }}-${{ hashFiles('**/go.mod') }}
        - name: Download modules
          run: go mod download
        - name: Build
          run: go build ./...
```
> If there are several builds on the same repo it might make sense to create a cache in one build and use it in the
others. The action [actions/cache/restore](https://github.com/actions/cache/tree/main/restore#only-restore-cache)
should be used in this case.

### Matrix Testing

Test across multiple Go versions:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        go-version: ['1.21', '1.22', '1.23']
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-go@v6
        with:
          go-version: ${{ matrix.go-version }}
      - run: go test ./...
```

## Advanced Configuration

### Supported Version Syntax

The `go-version` input supports the following syntax:

| Syntax Type | Example | Description |
|-------------|---------|-------------|
| Specific version | `1.23.2` | Installs this exact version |
| Semantic range (caret) | `^1.23.0` | Allows newer minor/patch versions (1.24.x, 1.25.x, etc.) |
| Semantic range (tilde) | `~1.23.0` | Allows newer patch versions only (1.23.1, 1.23.2, etc.) |
| Comparison (gte) | `>=1.22.0` | Any version equal to or newer than specified |
| Comparison (lt) | `<1.24.0` | Any version older than specified |
| Comparison range | `>=1.22.0 <1.24.0` | Any version within the specified range |
| Wildcard (patch) | `1.23.x` | Latest patch version of the specified minor release |
| Wildcard (minor) | `1.*` | Latest available version in the major version |
| Pre-release | `1.24.0-rc.1` | Beta/RC versions for testing upcoming releases |
| Aliases | `stable`, `oldstable` | Latest stable or previous stable release |

For more information about semantic versioning, see the [semver documentation](https://semver.org/).

### Complete Input Reference

```yaml
- uses: actions/setup-go@v6
  with:
    # Version or version range of Go to use
    go-version: '1.23'
    
    # Path to go.mod, go.work, .go-version, or .tool-versions file
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

setup-go comes pre-installed on GHES when Actions is enabled. For dynamic Go version downloads, the action fetches distributions from the [go-versions repository](https://github.com/actions/go-versions/) on github.com (external to your appliance).

These calls to `actions/go-versions` are made via unauthenticated requests, which are limited to 60 requests per hour per IP. If more requests are made within the time frame, then the action leverages the raw API to retrieve the version-manifest. This approach does not impose a rate limit and hence facilitates unrestricted consumption. This is particularly beneficial for GHES runners, which often share the same IP, to avoid the quick exhaustion of the unauthenticated rate limit. If that fails as well the action will try to download versions directly from [go.dev](https://go.dev/dl).

If that fails as well you can get a higher rate limit with generating a personal access token on github.com and passing it as the token input to the action:

```yaml
uses: actions/setup-go@v6
with:
  token: ${{ secrets.GH_DOTCOM_TOKEN }}
  go-version: '1.23'
```

### Offline Runners

For runners without github.com access, Go versions must be pre-cached in the runner's tool cache. See "[Setting up the tool cache on self-hosted runners without internet access](https://docs.github.com/en/enterprise-server@3.2/admin/github-actions/managing-access-to-actions-from-githubcom/setting-up-the-tool-cache-on-self-hosted-runners-without-internet-access)".

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
