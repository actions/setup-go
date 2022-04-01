# 0. Caching dependencies
Date: 2022-03-29

Status: Accepted

# Context
`actions/setup-go` is the one of the most popular action related to Golang in GitHub Actions. Many customers use it in conjunction with [actions/cache](https://github.com/actions/cache) to speed up dependency installation process.  
See more examples on proper usage in [actions/cache documentation](https://github.com/actions/cache/blob/main/examples.md#go---modules).

# Goals & Anti-Goals
Integration of caching functionality into `actions/setup-go` action will bring the following benefits for action users:
- Decrease the entry threshold for using the cache for Go dependencies and simplify initial configuration
- Simplify YAML pipelines because there will be no need for additional steps to enable caching
- More users will use cache for Go so more customers will have fast builds!

We don't pursue the goal to provide wide customization of caching in scope of `actions/setup-go` action. The purpose of this integration is covering ~90% of basic use-cases. If user needs flexible customization, we should advice them to use `actions/cache` directly.

# Decision
- Add `cache` input parameter to `actions/setup-go`. For now, input will accept the following values: 
  - `true` - enable caching for go dependencies
  - `false` and `''` - disable caching for go dependencies. This value will be set as default value
We're planning to get these values as strings. That will enable us to extend the functionality in future much easier if we get proposals for it.
- Cache feature will be disabled by default to make sure that we don't break existing customers. We will consider enabling cache by default in next major releases
- Action will try to search a go.sum files in the repository and throw error in the scenario that it was not found
- The hash of found file will be used as cache key (the same approach like [actions/cache](https://github.com/actions/cache/blob/main/examples.md#go---modules) recommends)
- The following key cache will be used `${{ runner.os }}-go${{ go-version }}-${{ hashFiles('<go.sum-path>') }}`
- Action will cache global cache from the `go env GOCACHE` command

# Example of real use-cases

```yml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-go@v3
  with:
    go-version: '16'
    cache: true
```

# Release process

As soon as functionality is implemented, we will release minor update of action. No need to bump major version since there are no breaking changes for existing users.
After that, we will update [starter-workflows](https://github.com/actions/starter-workflows/blob/main/ci/go.yml)