  
#!/bin/sh

if [ -z "$1" ]; then
  echo "Must supply go version argument"
  exit 1
fi

go_version="$(go version)"
echo "Found go version '$go_version'"
if [ -z "$(echo $go_version | grep $1)" ]; then
  echo "Unexpected version"
  exit 1
fi