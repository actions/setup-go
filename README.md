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

### V6 - Major Updates

#### Critical Requirements
- **Node Runtime**: Upgraded from Node 20 to Node 24
- **⚠️ Action Required**: Ensure your runner is on version **v2.327.1 or later** for compatibility
- See [Release Notes](https://github.com/actions/setup-go/releases)

#### Enhanced Toolchain Management
V6 significantly improves toolchain handling for more reliable and consistent Go version selection:

**Now supports `toolchain` directive from go.mod:**
```go
go 1.21.0           // Minimum required version
toolchain go1.21.6  // V6 uses this exact version when specified
```

### V5 - Previous Updates
- Upgraded Node.js runtime from node16 to node20
- See [full release notes](https://github.com/actions/setup-go/releases)

## Usage

See [action.yml](action.yml)

### Basic Setup

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.16.1' # The Go version to download (if necessary) and use
  - run: go run hello.go
```

### Version Selection

#### Semantic Versioning

```yaml
# Using caret notation (latest patch release)
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '^1.13.1' # The Go version to download (if necessary) and use
  - run: go version
```

```yaml
# Using comparison operators
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '>=1.17.0'
  - run: go version
```

> **Note**: Due to YAML parsing behavior, always wrap version numbers in single quotes:
> ```yaml
> go-version: '1.20'  # Correct
> ```
> Without quotes, YAML interprets `1.20` as `1.2`, which may cause unexpected behavior.

#### Pre-release Versions

```yaml
# RC version
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.18.0-rc.1' # The Go version to download (if necessary) and use
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

### Check Latest Version

The `check-latest` flag defaults to `false`. Use the default or set `check-latest` to `false` if you prefer stability and want to ensure a specific Go version is always used.

If `check-latest` is set to `true`, the action first checks if the cached version is the latest one. If the locally cached version is not the most up-to-date, a Go version will then be downloaded.

> **Note**: Setting `check-latest` to `true` has performance implications as downloading Go versions is slower than using cached versions.

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.14'
      check-latest: true
  - run: go run hello.go
```

### Using stable/oldstable Aliases

If `stable` is provided, action will get the latest stable version from the go-versions repository manifest.

If `oldstable` is provided, when current release is 1.19.x, action will resolve version as 1.18.x, where x is the latest patch release.

> **Note**: Using these aliases will result in same version as using corresponding minor release with `check-latest` input set to `true`

```yaml
# Latest stable version
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: 'stable'
  - run: go run hello.go
```

```yaml
# Previous stable version
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: 'oldstable'
  - run: go run hello.go
```

### Caching Dependencies and Build Outputs

The action has built-in functionality for caching and restoring go modules and build outputs. It uses `toolkit/cache` under the hood but requires less configuration settings. The cache input is optional, and caching is turned on by default.

The action defaults to search for the dependency file - `go.sum` in the repository root, and uses its hash as a part of the cache key. Use `cache-dependency-path` input for cases when multiple dependency files are used, or they are located in different subdirectories. The input supports glob patterns.

If some problem that prevents success caching happens then the action issues the warning in the log and continues the execution of the pipeline.

#### Caching in Monorepos

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.17'
      check-latest: true
      cache-dependency-path: |
        subdir/go.sum
        tools/go.sum
      # Alternative: cache-dependency-path: "**/*.sum"
  - run: go run hello.go
```

### Getting Go Version from go.mod File

The `go-version-file` input accepts a path to a `go.mod` file or a `go.work` file that contains the version of Go to be used by a project. The version taken from this file will be:

1. The version from the `toolchain` directive, if there is one, otherwise
2. The version from the `go` directive

The version can specify a patch version or omit it altogether (e.g., `go 1.22.0` or `go 1.22`).

- If a patch version is specified, that specific patch version will be used
- If no patch version is specified, it will search for the latest available patch version in the cache, versions-manifest.json, and the official Go language website, in that order

> **Note**: If both `go-version` and `go-version-file` inputs are provided then the `go-version` input is used.

The action will search for the `go.mod` file relative to the repository root:

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version-file: 'path/to/go.mod'
  - run: go version
```

### Matrix Testing

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        go: [ '1.14', '1.13' ]
    name: Go ${{ matrix.go }} sample
    steps:
      - uses: actions/checkout@v5
      - name: Setup go
        uses: actions/setup-go@v6
        with:
          go-version: ${{ matrix.go }}
      - run: go run hello.go
```

## Version Resolution

The action will first check the local cache for a version match. If a version is not found locally, it will pull it from the main branch of the [go-versions](https://github.com/actions/go-versions) repository. On miss or failure, it will fall back to downloading directly from [go dist](https://go.dev/dl/). To change the default behavior, please use the `check-latest` input.

> **Note**: The setup-go action uses executable binaries which are built by Golang side. The action does not build golang from source code.

## Supported Version Syntax

The `go-version` input supports the following syntax:

- **Specific versions**: `1.15`, `1.16.1`, `1.17.0-rc.2`, `1.16.0-beta.1`
- **SemVer's version range syntax**: `^1.13.1`, `>=1.18.0-rc.1`

For more information about semantic versioning, please refer to [semver documentation](https://semver.org/).

## Using setup-go on GHES

`setup-go` comes pre-installed on the appliance with GHES if Actions is enabled. When dynamically downloading Go distributions, `setup-go` downloads distributions from `actions/go-versions` on github.com (outside of the appliance).

These calls to `actions/go-versions` are made via unauthenticated requests, which are limited to 60 requests per hour per IP. If more requests are made within the time frame, then the action leverages the raw API to retrieve the version-manifest. This approach does not impose a rate limit and hence facilitates unrestricted consumption. This is particularly beneficial for GHES runners, which often share the same IP, to avoid the quick exhaustion of the unauthenticated rate limit. If that fails as well the action will try to download versions directly from https://storage.googleapis.com/golang.

If that fails as well you can get a higher rate limit with generating a personal access token on github.com and passing it as the token input to the action:

```yaml
uses: actions/setup-go@v6
with:
  token: ${{ secrets.GH_DOTCOM_TOKEN }}
  go-version: '1.18'
```

If the runner is not able to access github.com, any Go versions requested during a workflow run must come from the runner's tool cache. See ["Setting up the tool cache on self-hosted runners without internet access"](https://docs.github.com/en/enterprise-server@latest/admin/github-actions/managing-access-to-actions-from-githubcom/setting-up-the-tool-cache-on-self-hosted-runners-without-internet-access) for more information.

## Recommended Permissions

When using the setup-go action in your GitHub Actions workflow, it is recommended to set the following permissions to ensure proper functionality:

```yaml
permissions:
  contents: read # access to check out code and install dependencies
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

## Contributions

Contributions are welcome! See [Contributor's Guide](docs/contributors.md)

## Code of Conduct

👋 Be nice. See our [code of conduct](CODE_OF_CONDUCT.md)