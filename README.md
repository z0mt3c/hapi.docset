# joi.docset
Just a simple dash docset for joi (https://github.com/hapijs/joi). Available through dashs "user contributed" channel ;-)

## Generate Docset

This requires [Node.js](https://nodejs.org/en/download/) and [sqlite](https://www.sqlite.org/) to be installed.

```bash
npm install
node generate
tar --exclude='.DS_Store' -cvzf ./releases/joi-XXX.tgz joi.docset
```
