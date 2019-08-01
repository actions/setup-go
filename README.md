# setup-go

This action sets up a go environment for use in actions by:

- optionally downloading and caching a version of go by version and adding to PATH
- registering problem matchers for error output

# Usage

See [action.yml](action.yml)

Basic:
```yaml
steps:
- uses: actions/checkout@master
- uses: actions/setup-go@v1
  with:
    version: 1.9.3 // The Go version to download (if necessary) and use.
- run: go run hello.go
```

Matrix Testing:
```yaml
jobs:
  build:
    strategy:
      matrix:
        go: [ 1.8, 1.9.3, 1.10 ]
    name: Go ${{ matrix.go }} sample
    steps:
      - uses: actions/checkout@master
      - name: Setup go
        uses: actions/setup-go@v1
        with:
          version: ${{ matrix.go }}
      - run: go run hello.go
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

# Contributions

Contributions are welcome!  See [Contributor's Guide](docs/contributors.md)
