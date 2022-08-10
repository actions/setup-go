## Architecture

You can use any of the [supported operating systems](https://docs.github.com/en/actions/reference/virtual-environments-for-github-hosted-runners), and the compatible `architecture` can be selected by specifying a value for `architecture` input variable. Values are `x86`, `x64`, `arm`, `arm64`, `amd64` (not all of the architectures are available on all platforms).

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    name: Go sample
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v3
        with:
          go-version: '18'
          architecture: 'amd64' # optional, x64 or x86. If not specified, x64 will be used by default
```