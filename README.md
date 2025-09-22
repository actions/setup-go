# setup-go

[![Basic validation](https://github.com/actions/setup-go/actions/workflows/basic-validation.yml/badge.svg)](https://github.com/actions/setup-go/actions/workflows/basic-validation.yml)
[![Validate 'setup-go'](https://github.com/actions/setup-go/actions/workflows/versions.yml/badge.svg)](https://github.com/actions/setup-go/actions/workflows/versions.yml)

This action sets up a Go environment for use in GitHub Actions by:

- ✅ Optionally downloading and caching a version of Go by version and adding to PATH
- ✅ Registering problem matchers for error output

## 🚨 Breaking Changes in V6

### Critical Requirements

#### Node Runtime Upgrade
- **Upgraded**: Node 20 → Node 24
- **⚠️ Action Required**: Ensure your runner is on version **v2.327.1 or later** for compatibility
- **Reference**: [Release Notes](https://github.com/actions/setup-go/releases)

### Enhanced Go Toolchain Management

V6 introduces significant improvements to ensure reliable and consistent Go version selection:

#### 1. Toolchain Directive Support
Now correctly interprets both `go` and `toolchain` directives from `go.mod`:

```go
go 1.21.0           // Minimum required version
toolchain go1.21.6  // V6 uses this exact version
```

#### 2. Advanced Version Resolution
Supports comprehensive version patterns:

| Pattern Type | Examples | Description |
|-------------|----------|-------------|
| **Comparison Operators** | `>=1.21.0`, `<1.22.0` | Range-based selection |
| **Semantic Versioning** | `~1.21.0`, `^1.21.0` | Patch/minor updates |
| **Wildcards** | `1.21.x`, `1.*` | Flexible matching |

#### 3. Intelligent Caching
- Cache keys now incorporate toolchain-specific metadata
- Eliminates version conflicts when switching between Go versions
- Improved workflow reliability

### Migration Benefits
✅ Exact Go version matching  
✅ Improved build reproducibility  
✅ Reduced version-related issues

For more details, see the [full release notes](https://github.com/actions/setup-go/releases).

---

## 📋 Previous Versions

### V5 Changes
- Upgraded Node.js runtime from node16 to node20
- See [full V5 release notes](https://github.com/actions/setup-go/releases)

---

## 🚀 Usage

See [action.yml](action.yml)

### Basic Setup

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.16.1' # The Go version to download (if necessary) and use.
  - run: go run hello.go
```

### Version Selection Examples

#### Using Semantic Versioning

```yaml
# Caret notation (minor updates)
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '^1.13.1'
  - run: go version
```

```yaml
# Comparison operators
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '>=1.17.0'
  - run: go version
```

> **⚠️ Important**: Always wrap version numbers in single quotes to prevent YAML parsing issues:
> ```yaml
> go-version: '1.20'  # ✅ Correct
> go-version: 1.20    # ❌ Incorrect - YAML interprets as 1.2
> ```

#### Pre-release Versions

```yaml
# RC version
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.18.0-rc.1'
  - run: go version
```

```yaml
# Beta version
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.16.0-beta.1'
  - run: go version
```

---

## 🔧 Advanced Features

### Check Latest Version

The `check-latest` flag defaults to `false` for stability. Set to `true` if you want the most up-to-date Go version.

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version: '1.14'
      check-latest: true
  - run: go run hello.go
```

> **Note**: Setting `check-latest: true` has performance implications as downloading Go versions is slower than using cached versions.

### Using Stable/Oldstable Aliases

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

> **Note**: Using these aliases will result in the same version as using the corresponding minor release with `check-latest: true`

### Caching Dependencies and Build Outputs

The action has built-in functionality for caching and restoring go modules and build outputs. Caching is **enabled by default**.

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

### Getting Go Version from go.mod

The action can read the Go version directly from your `go.mod` or `go.work` file:

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: actions/setup-go@v6
    with:
      go-version-file: 'path/to/go.mod'
  - run: go version
```

Priority order for version selection:
1. `toolchain` directive (if present)
2. `go` directive

> **Note**: If both `go-version` and `go-version-file` are provided, `go-version` takes precedence.

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

---

## 📝 Supported Version Syntax

The `go-version` input supports:

- **Specific versions**: `1.15`, `1.16.1`, `1.17.0-rc.2`, `1.16.0-beta.1`
- **SemVer ranges**: `^1.13.1`, `>=1.18.0-rc.1`

For more information about semantic versioning, please refer to [semver documentation](https://github.com/npm/node-semver).

---

## 🏢 Using setup-go on GHES

setup-go comes pre-installed on the appliance with GHES if Actions is enabled. When dynamically downloading Go distributions, setup-go downloads distributions from `actions/go-versions` on github.com (outside of the appliance).

These calls to `actions/go-versions` are made via unauthenticated requests (limited to 60 requests per hour per IP). If more requests are needed:

1. The action leverages the raw API to retrieve the version-manifest (no rate limit)
2. If that fails, attempts to download directly from `https://storage.googleapis.com/golang`

### Using a Personal Access Token

For higher rate limits:

```yaml
uses: actions/setup-go@v6
with:
  token: ${{ secrets.GH_DOTCOM_TOKEN }}
  go-version: '1.18'
```

If the runner cannot access github.com, any Go versions requested during a workflow run must come from the runner's tool cache. See ["Setting up the tool cache on self-hosted runners without internet access"](https://docs.github.com/en/enterprise-server@3.2/admin/github-actions/managing-access-to-actions-from-githubcom/setting-up-the-tool-cache-on-self-hosted-runners-without-internet-access) for more information.

---

## 🔒 Recommended Permissions

When using the setup-go action in your GitHub Actions workflow, set the following permissions:

```yaml
permissions:
  contents: read  # access to check out code and install dependencies
```

---

## ⚙️ How It Works

### Version Resolution Order

1. **Local cache** check for version match
2. **go-versions repository** (main branch) on cache miss  
3. **Direct download** from go dist as fallback

> **Note**: The setup-go action uses executable binaries built by the Golang team. The action does not build Go from source code.

---

## 📄 License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

## 🤝 Contributions

Contributions are welcome! See [Contributor's Guide](docs/contributors.md)

## 👮 Code of Conduct

👋 Be nice. See our [code of conduct](CODE_OF_CONDUCT.md)