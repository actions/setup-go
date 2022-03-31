# setup-go

[![build-test](https://github.com/actions/setup-go/actions/workflows/workflow.yml/badge.svg)](https://github.com/actions/setup-go/actions/workflows/workflow.yml)
[![Validate 'setup-go'](https://github.com/actions/setup-go/actions/workflows/versions.yml/badge.svg)](https://github.com/actions/setup-go/actions/workflows/versions.yml)

This action sets up a go environment for use in actions by:

- Optionally downloading and caching a version of Go by version and adding to `PATH`.
- Registering problem matchers for error output.

# V3

The V3 edition of the action offers:

- Adds `GOBIN` to the `PATH`
- Proxy support
- Check latest version
- Bug fixes (including issues around version matching and semver)

The action will first check the local cache for a version match. If a version is not found locally, it will pull it from the `main` branch of the [go-versions](https://github.com/actions/go-versions/blob/main/versions-manifest.json) repository. On miss or failure, it will fall back to downloading directly from [go dist](https://storage.googleapis.com/golang). To change the default behavior, please use the [check-latest input](#check-latest-version).

Matching by [semver spec](https://github.com/npm/node-semver):

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-go@v3
    with:
      go-version: '^1.13.1' # The Go version to download (if necessary) and use.
  - run: go version
```

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-go@v3
    with:
      go-version: '>=1.17.0'
  - run: go version
```

Matching an unstable pre-release:
```yaml
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-go@v3
    with:
      go-version: '1.18.0-rc.1' # The Go version to download (if necessary) and use.
  - run: go version
```

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-go@v3
    with:
      go-version: '1.16.0-beta.1' # The Go version to download (if necessary) and use.
  - run: go version
```

# Usage

See [action.yml](action.yml)

## Basic:

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-go@v3
    with:
      go-version: '1.16.1' # The Go version to download (if necessary) and use.
  - run: go run hello.go
```


## Check latest version:

The `check-latest` flag defaults to `false`. Use the default or set `check-latest` to `false` if you prefer stability and if you want to ensure a specific Go version is always used.

If `check-latest` is set to `true`, the action first checks if the cached version is the latest one. If the locally cached version is not the most up-to-date, a Go version will then be downloaded. Set `check-latest` to `true` if you want the most up-to-date Go version to always be used.

> Setting `check-latest` to `true` has performance implications as downloading Go versions is slower than using cached versions.

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-go@v3
    with:
      go-version: '1.14'
      check-latest: true
  - run: go run hello.go
```

## Matrix Testing:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        go: [ '1.14', '1.13' ]
    name: Go ${{ matrix.go }} sample
    steps:
      - uses: actions/checkout@v3
      - name: Setup go
        uses: actions/setup-go@v3
        with:
          go-version: ${{ matrix.go }}
      - run: go run hello.go
```

### Supported version syntax

The `go-version` input supports the following syntax:

Specific versions: `1.15`, `1.16.1`, `1.17.0-rc.2`, `1.16.0-beta.1`
SemVer's version range syntax: `^1.13.1`, `>=1.18.0-rc.1`
For more information about semantic versioning please refer [semver](https://github.com/npm/node-semver) documentation

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

# Contributions

Contributions are welcome!  See [Contributor's Guide](docs/contributors.md)

## Code of Conduct

:wave: Be nice.  See [our code of conduct](CONDUCT)
