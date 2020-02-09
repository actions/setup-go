# setup-go

<p align="left">
  <a href="https://github.com/actions/setup-go/actions"><img alt="GitHub Actions status" src="https://github.com/actions/setup-go/workflows/build-test/badge.svg"></a>

  <a href="https://github.com/actions/setup-go/actions"><img alt="versions status" src="https://github.com/actions/setup-go/workflows/go-versions/badge.svg"></a>  
</p>

This action sets up a go environment for use in actions by:

- optionally downloading and caching a version of Go by version and adding to PATH
- registering problem matchers for error output

# Usage

See [action.yml](action.yml)

Basic:
```yaml
steps:
- uses: actions/checkout@master
- uses: actions/setup-go@v1
  with:
    go-version: '1.9.3' # The Go version to download (if necessary) and use.
- run: go run hello.go
```

Matrix Testing:
```yaml
jobs:
  build:
    runs-on: ubuntu-16.04
    strategy:
      matrix:
        go: [ '1.13', '1.12' ]
    name: Go ${{ matrix.go }} sample
    steps:
      - uses: actions/checkout@v2
      - name: Setup go
        uses: actions/setup-go@v1
        with:
          go-version: ${{ matrix.go }}
      - run: go run hello.go
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

# Contributions

Contributions are welcome!  See [Contributor's Guide](docs/contributors.md)

## Code of Conduct

:wave: Be nice.  See [our code of conduct](CONDUCT)
