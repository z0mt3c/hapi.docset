# hapi.docset
Just a simple dash docset for hapi.js (https://github.com/hapijs/hapi). Available through dashs "user contributed" channel ;-)

## Generate Docset

This requires [Node.js](https://nodejs.org/en/download/) and [sqlite](https://www.sqlite.org/) to be installed.

```bash
npm install
node generate.js
tar --exclude='.DS_Store' -cvzf ./releases/hapi-XXX.tgz hapi.docset
```
