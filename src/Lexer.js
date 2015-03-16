/**
 * The Lexer class tokenizes the input sequentially, looking ahead only one
 * token.
 */
var utils = require('./utils');
var ParseError = require('./ParseError');

var Lexer = function(input) {
    this._input = input;
    this._remain = input;
    this._pos = 0;
    this._nextAtom = this._currentAtom = null;
    this._next(); // get the next atom
};

Lexer.prototype.accept = function(type, text) {
    if (this._nextAtom.type === type && this._matchText(text)) {
        this._next();
        return this._currentAtom.text;
    }
    return null;
};

Lexer.prototype.expect = function(type, text) {
    var nextAtom = this._nextAtom;
    // The next atom is NOT of the right type
    if (nextAtom.type !== type)
        throw new ParseError('Expect an atom of ' + type + ' but received ' +
                             nextAtom.type, this._pos, this._input);
    // Check whether the text is exactly the same
    if (!this._matchText(text))
            throw new ParseError('Expect `' + text + '` but received `' +
                                 nextAtom.text + '`', this._pos, this._input);

    this._next();
    return this._currentAtom.text;
};

Lexer.prototype.get = function() {
    return this._currentAtom;
};

/* Math pattern
    Math environtment like $ $ or \( \) cannot be matched using regular
    expression. This object simulates a RegEx object
*/
var mathPattern = {
    exec: function(str) {
        if (str.indexOf('$') !== 0) return null;

        var pos = 1;
        var len = str.length;
        while (pos < len && ( str[pos] != '$' || str[pos - 1] == '\\' ) ) pos++;

        if (pos === len) return null;
        return [str.substring(0, pos + 1), str.substring(1, pos)];
    }
};
var atomRegex = {
    // TODO: which is correct? func: /^\\(?:[a-zA-Z]+|.)/,
    special: /^(\\\\|\\{|\\}|\\\$|\\&|\\#|\\%|\\_)/,
    func: /^\\([a-zA-Z]+)/,
    open: /^\{/,
    close: /^\}/,
    quote: /^(`|``|'|'')/,
    ordinary: /^[^\\{}$&#%_\s]+/,
    math: mathPattern ///^\$.*\$/,
};
var commentRegex = /^%.*/;
var whitespaceRegex = /^\s+/;

Lexer.prototype._skip = function(len) {
    this._pos += len;
    this._remain = this._remain.slice(len);
};

/* Get the next atom */
Lexer.prototype._next = function() {
    var anyWhitespace = false;
    while (1) {
        // Skip whitespace (one or more)
        var whitespaceMatch = whitespaceRegex.exec(this._remain);
        if (whitespaceMatch) {
            anyWhitespace = true;
            var whitespaceLen = whitespaceMatch[0].length;
            this._skip(whitespaceLen);
        }

        // Skip comment
        var commentMatch = commentRegex.exec(this._remain);
        if (!commentMatch) break;
        var commentLen = commentMatch[0].length;
        this._skip(commentLen);
    }

    // Remember the current atom
    this._currentAtom = this._nextAtom;

    // Reach the end of string
    if (this._remain === '') {
        this._nextAtom = {
            type: 'EOF',
            text: null,
            whitespace: false
        };
        return false;
    }

    // Try all kinds of atoms
    for (var type in atomRegex) {
        var regex = atomRegex[type];

        var match = regex.exec(this._remain);
        if (!match) continue; // not matched

        // match[1] is the useful part, e.g. '123' of '$123$', 'it' of '\\it'
        var matchText = match[0];
        var usefulText = match[1] ? match[1] : matchText;

        this._nextAtom = {
            type: type, /* special, func, open, close, ordinary, math */
            text: usefulText, /* the text value of the atom */
            whitespace: anyWhitespace /* any whitespace before the atom */
        };

        this._pos += matchText.length;
        this._remain = this._remain.slice(match[0].length);

        return true;
    }

    throw new ParseError('Unrecoganizable atom', this._pos, this._input);
};

/* Check whether the text of the next atom matches */
Lexer.prototype._matchText = function(text) {
    // don't need to match
    if (text === null || text === undefined) return true;

    if (utils.isString(text)) // is a string, exactly the same?
        return text === this._nextAtom.text;
    else // is a list, match any of them?
        return text.indexOf(this._nextAtom.text) >= 0;
};

module.exports = Lexer;