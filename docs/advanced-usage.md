# Advanced Usage
- [Using the go-version input](advanced-usage.md#using-the-go-version-input)
    - [Specifying a go version](advanced-usage.md#specifying-a-go-version)
    - [Matrix testing](advanced-usage.md#matrix-testing)
- [Using the go-version-file input](advanced-usage.md#using-the-go-version-file-input)
- [Check latest version](advanced-usage.md#check-latest-version)
- [Caching](advanced-usage.md#caching)
    - [Caching in monorepos](advanced-usage.md#caching-in-monorepos)
    - [Caching in multi-module repositories](advanced-usage.md#caching-in-multi-module-repositories)
    - [Multi-target builds](advanced-usage.md#multi-target-builds)
    - [Cache invalidation on source changes](advanced-usage.md#cache-invalidation-on-source-changes)
    - [Restore-only caches](advanced-usage.md#restore-only-caches)
    - [Parallel builds](advanced-usage.md#parallel-builds)
- [Outputs](advanced-usage.md#outputs)
- [Using `setup-go` on GHES](advanced-usage.md#using-setup-go-on-ghes)

## Using the `go-version` input

### Specifying a Go version

For repeatable builds, specify the **exact major, minor, and patch version** (such as `1.25.5`):

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '1.25.5'
  - run: go run hello.go
```

- The only downside is that setup may take a little longer. If the exact version is not already installed on the runner due to more recent versions, the exact version will have to be downloaded.

You can specify **only a major and minor version** if you are okay with the most recent patch version being used:

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '1.25'
  - run: go run hello.go
```

- There will be a single patch version already installed on each runner for every minor version of Go that is supported.
- The preinstalled patch version is generally the latest available. When a new patch is released, it replaces the previously preinstalled version on the runner.
- Using the most recent patch version speeds up setup because the required Go version is already installed on the runner and no download is needed.

To try a **pre-release**:
Download and use beta or RC Go versions as needed.

```yaml
# RC version
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '1.25.0-rc.2'
  - run: go version
```

```yaml
# Beta version
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '1.19.0-beta.1'
  - run: go version
```

Using **stable/oldstable aliases**:

If `stable` is provided, the action will get the latest stable version from the [`go-versions`](https://github.com/actions/go-versions/blob/main/versions-manifest.json) repository manifest.

If `oldstable` is provided, the action resolves it to the latest patch release of the previous stable Go minor version (for example, if the latest stable is `1.25.x`, `oldstable` resolves to `1.24.x`, where `x` is the latest patch release).

**Note:** Using these aliases will result in the same version as when using the corresponding minor release with the `check-latest` input set to `true`.  

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: 'stable'
  - run: go run hello.go
```

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: 'oldstable'
  - run: go run hello.go
```

You can also use **SemVer's version range syntax**, for instance:

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '^1.25.1'
  - run: go version
```

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '>=1.24.0-rc.1'
  - run: go version
```

### Matrix testing

Using `setup-go` it's possible to use the [matrix syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix) to install several versions of Go:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        go: [ '1.24', '1.25' ]
    name: Go ${{ matrix.go }} sample
    steps:
      - uses: actions/checkout@v6
      - name: Setup go
        uses: actions/setup-go@v6
        with:
          go-version: ${{ matrix.go }}
      - run: go run hello.go
```

Exclude a specific Go version:

```yaml
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        go: [ '1.22', '1.24', '1.25']
        exclude:
          - os: macos-latest
            go: '1.22'
          - os: windows-latest
            go: '1.25'
    steps:
      - uses: actions/checkout@v6
      - name: Setup go
        uses: actions/setup-go@v6
        with:
          go-version: ${{ matrix.go }}
      - run: go run hello.go
```

## Using the `go-version-file` input

`setup-go` action can read the Go version from a version file. `go-version-file` input is used for specifying the path to the version file. If the file supplied to the `go-version-file` input doesn't exist, the action will fail with an error. This input supports go.mod, go.work, .go-version, and .tool-versions files.

If both the `go-version` and the `go-version-file` inputs are provided then the `go-version` input is used. The `.tool-versions` file supports version specifications in accordance with asdf standards, adhering to Semantic Versioning ([semver](https://semver.org)).

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version-file: 'path/to/go.mod'  # Read Go version from a file go.mod
  - run: go version
```

- Uses the `toolchain` directive if present, otherwise the action falls back to the `go` directive.

- The `go` directive in `go.mod` can specify a patch version or omit it altogether (e.g., `go 1.25.0` or `go 1.25`). If a patch version is specified, that specific patch version will be used. If no patch version is specified, it will search for the latest available patch version in the cache,
[versions-manifest.json](https://github.com/actions/go-versions/blob/main/versions-manifest.json), and the
[official Go language website](https://go.dev/dl/?mode=json&include=all), in that order.

> The action will search for the `go.mod` file relative to the repository root.

```yaml
steps:
 - uses: actions/checkout@v6
 - uses: actions/setup-go@v6
   with:
    go-version-file: '.go-version' # Read Go version from a file .go-version
- run: go version
```

```yaml
steps:
 - uses: actions/checkout@v6
 - uses: actions/setup-go@v6
   with:
     go-version-file: '.tool-versions' # Read Go version from a file .tool-versions
- run: go version
```

```yaml
steps:
- uses: actions/checkout@v6
- uses: actions/setup-go@v6
  with:
     go-version-file: 'go.work' # Read Go version from a file go.work file
- run: go version
```

## Check latest version

The `check-latest` flag defaults to `false`. Use the default or set `check-latest` to `false` if you prefer stability
and if you want to ensure a specific Go version is always used.

If `check-latest` is set to `true`, the action first checks if the cached version is the latest one. If the locally
cached version is not the most up-to-date, a Go version will then be downloaded. Set `check-latest` to `true` if you
want the most up-to-date Go version to always be used. It supports major (e.g., "1") and major.minor (e.g., "1.25") version selectors, always resolving to the latest matching patch release.

> Setting `check-latest` to `true` has performance implications as downloading Go versions is slower than using cached
> versions.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '1.25'
      check-latest: true
  - run: go run hello.go
```

## Caching
 
### Caching in monorepos

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '1.25'
      cache-dependency-path: subdir/go.sum
  - run: go run hello.go
```

### Caching in multi-module repositories

`cache-dependency-path` input accepts glob patterns and multi-line values:

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '1.25'
      cache-dependency-path: '**/go.sum'
  - run: go run hello.go
```

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '1.25'
      cache-dependency-path: |
        subdir/go.sum
        tools/go.sum
  - run: go run hello.go
```

### Multi-target builds

`cache-dependency-path` isn’t limited to dependency files (like `go.sum`). It can also include files that capture build settings (for example, `GOOS`/`GOARCH`). This allows separate caches per target platform (OS/architecture) and helps avoid reusing caches across incompatible builds.

```yaml
env:
  GOOS: ...
  GOARCH: ...

steps:
  - run: echo "$GOOS $GOARCH" > env.txt

  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: '1.25'
      cache-dependency-path: |
        go.sum
        env.txt
  - run: go run hello.go    
```

### Cache invalidation on source changes

Besides dependencies, the action can also cache build outputs (the [`GOCACHE`](https://pkg.go.dev/cmd/go#hdr-Build_and_test_caching) directory). By default, this cache is not updated based on source changes to help avoid unpredictable and frequent cache invalidation. To invalidate the cache when source files change, include source files in the `cache-dependency-path` input.

> **Note:** Including patterns like `**/*.go` can create new caches on many commits, increasing cache storage and potentially slowing workflows due to more frequent uploads/downloads.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: "1.25"
      cache-dependency-path: |
        go.sum
        **/*.go
  - run: go run hello.go
```

### Restore-only caches

Restore caches without saving new entries. This can help reduce cache writes and storage usage in workflows that only need to read from the cache:

```yaml
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v6
      - name: Setup go
        id: setup-go
        uses: actions/setup-go@v6
        with:
          go-version: '1.25.5'
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

> If there are several builds on the same repo, it may make sense to create a cache in one build and use it in others. The action [actions/cache/restore](https://github.com/actions/cache/tree/main/restore#only-restore-cache)
should be used in this case.

### Parallel builds

To avoid race conditions during parallel builds, either use distinct cache keys with [actions/cache](https://github.com/actions/cache/blob/main/examples.md#go---modules), or create the cache in only one build and [restore](#restore-only-caches) it in the other builds.

## Outputs

### `go-version`

Using **go-version** output, it's possible to get the precise Go version installed by the action. This output is useful when the input `go-version` is given as a range, but down the line you need to operate (such as in an `if:` statement) with the exact installed version (e.g. 1.24.11). 

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-go@v6
        id: go124
        with:
          go-version: '^1.24'
      - run: echo "Installed Go version: ${{ steps.go124.outputs.go-version }}"
```

### `cache-hit`

**cache-hit** output is available with a boolean value that indicates whether a cache hit occurred on the primary key:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-go@v6
        id: go124
        with:
          go-version: '1.24'
          cache: true
      - run: echo "Was the Go cache restored? ${{ steps.go124.outputs.cache-hit }}" # true if cache-hit occurred
```

## Using `setup-go` on GHES

### Avoiding rate limit issues

`setup-go` comes pre-installed on the appliance with GHES if Actions is enabled.
When dynamically downloading Go distributions, `setup-go` downloads distributions from [`actions/go-versions`](https://github.com/actions/go-versions) on github.com (outside of the appliance).

These calls to `actions/go-versions` are made via unauthenticated requests, which are limited to [60 requests per hour per IP](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting).
If more requests are made within the time frame, then the action leverages the `raw API` to retrieve the version-manifest. This approach does not impose a rate limit and hence facilitates unrestricted consumption. This is particularly beneficial for GHES runners, which often share the same IP, to avoid the quick exhaustion of the unauthenticated rate limit.
If that fails as well the action will try to download versions directly from [go.dev](https://go.dev/dl).

If that fails as well you can get a higher rate limit with [generating a personal access token on github.com](https://github.com/settings/tokens/new) and passing it as the `token` input to the action:

```yaml
uses: actions/setup-go@v6
with:
  token: ${{ secrets.GH_DOTCOM_TOKEN }}
  go-version: '1.25'
```

### No access to github.com

If the runner is not able to access github.com, any Go versions requested during a workflow run must come from the runner's tool cache.
See "[Setting up the tool cache on self-hosted runners without internet access](https://docs.github.com/en/enterprise-server@3.2/admin/github-actions/managing-access-to-actions-from-githubcom/setting-up-the-tool-cache-on-self-hosted-runners-without-internet-access)"
for more information.
