# @neoskop/flow-bump

> Handle git flow and version bumping

[![Known Vulnerabilities master][snyk-master-image]][snyk-master-url]

## Installation

```sh
$ yarn global add @neoskop/flow-bump    // via yarn
$ npm install -g @neoskop/flow-bump     // or via npm
```

## Usage

```sh
$ fb help
fb <command>

Commands:
  fb config                   Manipulate config files
  fb major [type]             Create a major version and branch
  fb minor [type]             Create a minor version and branch
  fb patch [type]             Create a patch version and branch
  fb fix [type]               Create a fix version and branch
  fb alpha                    Increase an alpha version
  fb beta                     Increase a beta version
  fb rc                       Increase a rc version
  fb release <semver> [type]  Create a release version and branch
  fb hotfix <semver> [type]   Create a hotfix version and branch
  fb final                    Finalize a version

Options:
  --help             Show help                                         [boolean]
  --version          Show version number                               [boolean]
  --pull             Pull from git before branching and bumping (via --no-pull)
  --push             Push to git after branching and bumping (via --no-push)
  --from-branch, -b  Create version from which branch                   [string]
  --from-tag, -t     Create version from which tag                      [string]
  --from-commit, -c  Create version from which commit                   [string]
  --commit-msg, -m   Template for commit message                        [string]
  --keep-branch, -k  Keep branch after git flow finish release         [boolean]
  --one-shot, -o     Create and finalize version in one step           [boolean]
  --tag-branch       Tag branch instead of master for final
```

## License

MIT License

Copyright (c) 2018 Neoskop GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## Sponsor

[![Neoskop GmbH][neoskop-image]][neoskop-url]

[snyk-master-image]: https://snyk.io/test/github/neoskop/flow-bump/master/badge.svg
[snyk-master-url]: https://snyk.io/test/github/neoskop/flow-bump/master

[neoskop-image]: ./neoskop.png
[neoskop-url]: https://www.neoskop.de/

