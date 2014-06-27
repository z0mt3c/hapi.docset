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
    return Q.Promise(function (resolve) {
        var matches;

        var stmt = db.prepare('INSERT OR IGNORE INTO searchIndex(name, type, path) VALUES (?, ?, ?)');

        var guidesRegex = /\n- *\[(?:`|)([^`\}\]]*)(?:`|)]\((#[A-Za-z\-]*)\)/g;

        while (matches = guidesRegex.exec(markdown)) {
            var method = matches[1];
            var anchor = matches[2];
            var type = 'Guide';

            if (/^Hapi.[a-z]/g.test(method)) {
                type = 'Property';
            } else if (/^Hapi.[A-Z]/g.test(method)) {
                type = 'Constructor';
            } else if (method.indexOf('(') !== -1) {
                type = 'Method';
            }

            stmt.run(method, type, 'reference.html' + anchor);
        }

        var methodRegex = /\n[\s]*-[\s]*\[`([A-Za-z\.]*.*)`]\((#[A-Za-z\-]*)\)/g;
        while (matches = methodRegex.exec(markdown)) {
            var method = matches[1];
            var anchor = matches[2];

            var type = 'Property';
            if (/^Hapi.[A-Z]/g.test(method)) {
                var type = 'Constructor';
            }

            if (method.indexOf('(') !== -1) {
                type = 'Method';

                if (method.indexOf('createServer') === 0) {
                    method = 'Hapi.' + method;
                    type = 'Constructor';
                } else if (method.indexOf('Pack.compose') === 0) {
                    type = 'Constructor';
                } else if (method.indexOf('prepareValue') === 0) {
                    method = 'Hapi.state.'+method;
                    type = 'Constructor';
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
        var replaced = text.replace(/user-content-/g, '');
        console.log('HTML cleanup completed!')
        return resolve(replaced);
    });
};

var addDashAnchors = function(text) {
    return Q.promise(function(resolve) {
        db.each('SELECT name, type, path FROM searchIndex', function(err, row) {
            console.log(row.name + ':' + row.type+':'+row.path);
            var dashAnchor = '<a name="//apple_ref/cpp/'+row.type+'/'+encodeURIComponent(row.name)+'" class="dashAnchor"></a>';
            var searchTerm = '<a name="' + row.path.split('#')[1] + '"';
            text = text.replace(new RegExp(searchTerm, 'g'), dashAnchor+searchTerm);
        }, function() {
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
    .then(createSearchIndex)
    .then(generateHtml)
    .then(replaceUserContent)
    .then(addDashAnchors)
    .then(wrapInDocument)
    .then(writeFile)
    .then(function (markdown) {
        console.log('Generation completed!');
    }).catch(function(e) {
        console.log(e);
    });
