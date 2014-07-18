var Q = require('q');
var request = require('request');
var fs = require('fs');
var sqlite3 = require('sqlite3');
var _ = require('lodash');
var mkdirp = require('mkdirp');
var docsetName = 'hapi.docset';
var referenceUrl = 'https://raw.githubusercontent.com/spumko/hapi/master/docs/Reference.md';

var documentsPath = './' + docsetName + '/Contents/Resources/Documents/';
mkdirp(documentsPath, function (err) {});

var dbFile = './' + docsetName + '/Contents/Resources/docSet.dsidx';
fs.unlink(dbFile, function(error) {
    if (!error) {
        console.log('Previous database deleted!');
    };
});

var db = new sqlite3.Database(dbFile);
db.serialize(function () {
    db.run("CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT);");
    db.run("CREATE UNIQUE INDEX anchor ON searchIndex (name, type, path);");
});

var hapiVersion = "NO-VERSION";


var prepareIndexEntry = function (method, anchor) {
    var type = 'Guide';

    if (/^(?:Hapi|plugin).[a-z]/g.test(method)) {
        type = 'Property';
    } else if (/^Hapi.[A-Z]/g.test(method)) {
        type = 'Constructor';
    }

    if (method.indexOf('(') !== -1) {
        type = 'Method';

        if (method.indexOf('createServer') === 0) {
            method = 'Hapi.' + method;
            type = 'Constructor';
        } else if (method.indexOf('Pack.compose') === 0) {
            type = 'Constructor';
        } else if (method.indexOf('prepareValue') === 0) {
            method = 'Hapi.state.' + method;
            type = 'Method';
        } else if (method.indexOf('message') !== -1) {
            method = 'Hapi.error.' + method;
            type = 'Error';
        } else if (method.indexOf('module.exports') === 0) {
            type = 'Plugin';
        }
    }

    if (method.indexOf('new ') === 0) {
        type = 'Constructor';
        method = 'Hapi.' + method.substr(4);
    } else if (method.indexOf('Interface') !== -1) {
        type = 'Interface';
        method = 'Plugin';
    }

    return {
        method: method,
        anchor: anchor,
        type: type
    }
};

var fetchRawMarkdown = function (url) {
    return Q.Promise(function (resolve, reject) {
        request(url, function (err, res, payload) {
            var remainingCalls = res && res.headers ? res.headers['x-ratelimit-remaining'] : null;

            if (remainingCalls) {
                console.log('Remaining github calls: ' + remainingCalls);
            }

            if (payload) {
                console.log('Raw markdown fetched!');
                return resolve(payload);
            } else {
                return reject(err);
            }
        });
    });
};

var echoVersion = function (markdown) {
    return Q.Promise(function (resolve) {
        var versionMatcher = /^# ([\d\.xX]*)/g;
        var match = versionMatcher.exec(markdown);
        if (match) {
            console.log('Hapi version: '+match[1]);
            hapiVersion = match[1];
        }
        resolve(markdown);
    });
};

var createSearchIndex = function (markdown) {
    return Q.Promise(function (resolve) {
        var matches;

        var stmt = db.prepare('INSERT OR IGNORE INTO searchIndex(name, type, path) VALUES (?, ?, ?)');

        var guidesRegex = /\n- *\[(?:`|)([^`\}\]]*)(?:`|)]\((#[A-Za-z\-]*)\)/g;

        while (matches = guidesRegex.exec(markdown)) {
            var entry = prepareIndexEntry(matches[1], matches[2]);
            stmt.run(entry.method, entry.type, 'reference.html' + entry.anchor);
        }

        var methodRegex = /\n[\s]*-[\s]*\[`([A-Za-z\.]*.*)`]\((#[A-Za-z\-]*)\)/g;
        while (matches = methodRegex.exec(markdown)) {
            var entry = prepareIndexEntry(matches[1], matches[2]);
            stmt.run(entry.method, entry.type, 'reference.html' + entry.anchor);
        }

        stmt.finalize();
        console.log('Search index created!');
        resolve(markdown);
    });
};


var generateHtml = function (markdown) {
    var payload = {
        text: markdown,
        mode: 'markdown',
        context: ''
    };

    return Q.Promise(function (resolve, reject) {
        request.post({ url: 'https://api.github.com/markdown',
            headers: {
                'User-Agent': 'hapi docset generator'
            },
            json: payload
        }, function (err, res, payload) {
            var remainingCalls = res && res.headers ? res.headers['x-ratelimit-remaining'] : null;

            if (remainingCalls) {
                console.log('Remaining github calls: ' + remainingCalls);
            }

            if (payload) {
                console.log('HTML generated from Markdown');
                return resolve(payload);
            } else {
                return reject(err);
            }
        });
    });
};

var replaceUserContent = function (text) {
    return Q.Promise(function (resolve) {
        var replaced = text.replace(/user-content-/g, '');
        console.log('HTML cleanup completed!')
        return resolve(replaced);
    });
};

var addDashAnchors = function (text) {
    return Q.promise(function (resolve) {
        db.each('SELECT name, type, path FROM searchIndex', function (err, row) {
            var dashAnchor = '<a name="//apple_ref/cpp/' + row.type + '/' + encodeURIComponent(row.name) + '" class="dashAnchor"></a>';
            var searchTerm = '<a name="' + row.path.split('#')[1] + '"';
            text = text.replace(new RegExp(searchTerm, 'g'), dashAnchor + searchTerm);
        }, function () {
            return resolve(text);
        });
    });
}

var wrapInDocument = function (text) {
    return Q.Promise(function (resolve) {
        var header = fs.readFileSync('./static/header.txt');
        var footer = fs.readFileSync('./static/footer.txt');
        console.log('Body wrapped with header and footer!');
        return resolve(header + text + footer);
    });
};

var writeFile = function (text) {
    return Q.Promise(function (resolve, reject) {
        fs.writeFile(documentsPath + '/reference.html', text, function (err) {
            if (err) {
                reject(err);
            } else {
                console.log('reference.html written');
                resolve(text);
            }
        });
    });
};

fetchRawMarkdown(referenceUrl)
    .then(echoVersion)
    .then(createSearchIndex)
    .then(generateHtml)
    .then(replaceUserContent)
    .then(addDashAnchors)
    .then(wrapInDocument)
    .then(writeFile)
    .then(function (markdown) {
        console.log('Generation of hapi.docset version '+hapiVersion+' completed!');
    }).catch(function (e) {
        console.log(e);
    });
