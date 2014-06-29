# joi.docset
Just a simple dash docset for joi (https://github.com/spumko/joi). Available through dashs "user contributed" channel ;-)

## Generate Docset

```bash
node generate
tar --exclude='.DS_Store' -cvzf ./releases/joi-XXX.tgz joi.docset
```