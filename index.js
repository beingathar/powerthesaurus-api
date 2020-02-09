var https = require('https')
var concat = require('concat-stream')
var unified = require('unified')
var parse = require('rehype-parse')
var $ = require('hast-util-select')
var toString = require('hast-util-to-string')
var randomAgent = require('random-fake-useragent').getRandom

module.exports = lookup

var own = {}.hasOwnProperty
var base = 'https://www.powerthesaurus.org'

var kinds = [
  'synonyms',
  'antonyms',
  'related',
  'narrower',
  'broader',
  'sound_like',
  'similar',
  'rhymes'
]

var shortPartToPart = {
  'adj.': 'adjective',
  'adv.': 'adverb',
  'conj.': 'conjunction',
  'exp.': 'expression',
  'idi.': 'idiom',
  'int.': 'interjection',
  'n.': 'noun',
  'phr. v.': 'phrasal verb',
  'pr.': 'pronoun',
  'prep.': 'preposition',
  'v.': 'verb'
}

var processor = unified().use(parse)

function lookup(word, kind, callback) {
  if (typeof kind !== 'string') {
    callback = kind
    kind = 'synonyms'
  }

  if (!kinds.includes(kind)) {
    throw new Error('Unexpected invalid kind `' + kind + '`')
  }

  if (!callback) {
    return new Promise(executor)
  }

  executor(null, callback)

  function executor(resolve, reject) {
    https
      .request(
        base + '/' + encodeURIComponent(word) + '/' + kind,
        {headers: {'user-agent': randomAgent()}},
        onrequest
      )
      .end()

    function onrequest(res) {
      res.on('error', done)
      res.pipe(concat(onconcat))
    }

    function onconcat(buf) {
      var tree = processor.parse(buf)

      done(null, $.selectAll('.pt-thesaurus-card', tree).map(each))
    }

    function done(err, res) {
      if (err) {
        reject(err)
      } else if (resolve) {
        resolve(res)
      } else {
        callback(null, res)
      }
    }
  }

  function each(node) {
    var word = serialize($.select('.link--term', node))
    var rating = serialize($.select('.pt-list-rating__counter', node))
    var topics = $.selectAll('.link--topic', node).map(serialize)
    var parts = $.selectAll('.link--part', node)
      .map(part)
      .filter(Boolean)

    return {word, rating: parseInt(rating, 10), parts, topics}
  }

  function part(node) {
    var value = serialize(node)

    if (!own.call(shortPartToPart, value)) {
      console.warn('powerthesaurus: could not map `%s` to part', value)
      return
    }

    return shortPartToPart[value]
  }

  function serialize(node) {
    return toString(node).trim()
  }
}
