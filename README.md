# setup-go

<p align="left">
  <a href="https://github.com/actions/setup-go/actions"><img alt="GitHub Actions status" src="https://github.com/actions/setup-go/workflows/build-test/badge.svg"></a>

  <a href="https://github.com/actions/setup-go/actions"><img alt="versions status" src="https://github.com/actions/setup-go/workflows/go-versions/badge.svg"></a>  
</p>

This action sets up a go environment for use in actions by:

- optionally downloading and caching a version of Go by version and adding to PATH
- registering problem matchers for error output

# V2

The V2 offers:
- Adds GOBIN to the PATH
- Proxy Support
- stable input 
- Bug Fixes (including issues around version matching and semver)

It will first check the local cache for a version match. If version is not found locally, It will pull it from `main` branch of [go-versions](https://github.com/actions/go-versions/blob/main/versions-manifest.json) repository and on miss or failure, it will fall back to the previous behavior of download directly from [go dist](https://storage.googleapis.com/golang).

Matching by [semver spec](https://github.com/npm/node-semver):
```yaml
steps:
  - uses: actions/checkout@v2
  - uses: actions/setup-go@v2
    with:
      go-version: '^1.13.1' # The Go version to download (if necessary) and use.
  - run: go version
```

Matching an unstable pre-release:
```yaml
steps:
  - uses: actions/checkout@v2
  - uses: actions/setup-go@v2
    with:
      stable: 'false'
      go-version: '1.14.0-rc1' # The Go version to download (if necessary) and use.
  - run: go version
```

# Usage

See [action.yml](action.yml)

Basic:
```yaml
steps:
  - uses: actions/checkout@master
  - uses: actions/setup-go@v2
    with:
      go-version: '1.16.1' # The Go version to download (if necessary) and use.
  - run: go run hello.go
```


Check latest version:  
> In basic example, without `check-latest` flag, the action tries to resolve version from local cache firstly and download only if it is not found. Local cache on image is updated with a couple of weeks latency.  
`check-latest` flag forces the action to check if the cached version is the latest one. It reduces latency significantly but it is much more likely to incur version downloading.
```yaml
steps:
  - uses: actions/checkout@master
  - uses: actions/setup-go@v2
    with:
      go-version: '1.14'
      check-latest: true
  - run: go run hello.go
```


Matrix Testing:
```yaml
jobs:
  build:
    runs-on: ubuntu-16.04
    strategy:
      matrix:
        go: [ '1.14', '1.13' ]
    name: Go ${{ matrix.go }} sample
    steps:
      - uses: actions/checkout@v2
      - name: Setup go
        uses: actions/setup-go@v2
        with:
          go-version: ${{ matrix.go }}
      - run: go run hello.go
```

### Supported version syntax
The `go-version` input supports the following syntax:

Specific versions: `1.15`, `1.16.1`, `1.17.0-rc2`, `1.16.0-beta1`  
SemVer's version range syntax: `^1.13.1`  
For more information about semantic versioning please refer [semver](https://github.com/npm/node-semver) documentation


# Keep in mind: latest, cached go compilers and semver notation.

The `setup-go` action doesn't install the latest matched version if the cached version matches one from WF file.

**For example:**  
Currently, there is three go compilers on [Ubuntu 20.04.3 LTS](https://github.com/actions/virtual-environments/blob/main/images/linux/Ubuntu2004-README.md) virtual environment: `1.15.15`, `1.16.12`, `1.17.5`.  
When the `1.17.6` version will be out and there is `1.17.*` in `go-version` field, the cached `1.17.5` version will be used. Not the new one. Until the cached version will be updated to the latest `1.17.6`.   
If you will specify fully `1.17.6`, the default installation process begins.

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

# Contributions

Contributions are welcome!  See [Contributor's Guide](docs/contributors.md)

## Code of Conduct

:wave: Be nice.  See [our code of conduct](CONDUCT)
