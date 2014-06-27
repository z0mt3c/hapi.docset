var fs = require('fs');
var dbFile = './hapi.docset/Contents/Resources/docSet.dsidx';
fs.unlink(dbFile);

var Q = require('q');
var request = require('request');
var referenceUrl = 'https://raw.githubusercontent.com/spumko/hapi/master/docs/Reference.md';
var documentsPath = './hapi.docset/Contents/Resources/Documents/';
var sqlite3 = require('sqlite3');

var db = new sqlite3.Database(dbFile);
db.serialize(function () {
    db.run("CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT);");
    db.run("CREATE UNIQUE INDEX anchor ON searchIndex (name, type, path);");
});

var _ = require('lodash');

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

var createSearchIndex = function (markdown) {
    return Q.Promise(function(resolve) {
        var matches;

        var stmt = db.prepare('INSERT OR IGNORE INTO searchIndex(name, type, path) VALUES (?, ?, ?)');

        var methodRegex = /\n[\s]*-[\s]*\[`([A-Za-z\.]*.*)`]\((#[A-Za-z\-]*)\)/g;

        while (matches = methodRegex.exec(markdown)) {
            var method = matches[1];
            var anchor = matches[2];
            var type = 'Property';
            if (method.indexOf('(') !== -1) {
                type = 'Method';
            }
            stmt.run(method, type, 'reference.html' + anchor);
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
        console.log('HTML cleanup completed!')
        var replaced = text.replace(/user-content-/g, '');
        resolve(replaced);
    });
};

var wrapInDocument = function (text) {
    return Q.Promise(function (resolve) {
        var header = fs.readFileSync('./static/header.txt');
        var footer = fs.readFileSync('./static/footer.txt');
        console.log('Body wrapped with header and footer!');
        resolve(header + text + footer);
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
    .then(createSearchIndex)
    .then(generateHtml)
    .then(replaceUserContent)
    .then(wrapInDocument)
    .then(writeFile)
    .then(function (markdown) {
        console.log('Generation completed!');
    });
