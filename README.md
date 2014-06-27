# hapi.docset
Just a simple dash docset for hapi.js (https://github.com/spumko/hapi).

## Install Docset
<a href="http://is.gd/hdExjf">INSTALL DOCSET</a> (This link only works on Mac with [DASH](https://itunes.apple.com/de/app/dash-docs-snippets/id458034879?mt=12) installed :-))

Subscribes to:
https://github.com/z0mt3c/hapi.docset/raw/master/releases/hapi.xml


## Generate Docset

```bash
node generate
tar --exclude='.DS_Store' -cvzf ./releases/hapi-20140628.tgz hapi.docset
openssl sha1 releases/hapi-20140628.tgz
``