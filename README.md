# hapi.docset
Just a simple dash docset for hapi.js (https://github.com/spumko/hapi). Available through dashs "user contributed" channel ;-)

## Generate Docset

```bash
node generate
tar --exclude='.DS_Store' -cvzf ./releases/hapi-XXX.tgz hapi.docset
```