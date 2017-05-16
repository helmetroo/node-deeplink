var fs = require('fs')
var inliner = require('html-inline')
var stream = require('stream')
var path = require('path')
var cheerio = require('cheerio')
var _ = require('lodash')

function toShareTag(shareDatum) {
    var metaTag = '<meta></meta>'
    var $ = cheerio.load(metaTag)

    _.each(shareDatum, function(value, key) {
        $('meta').attr(key, value)
    })

    var metaTagHtml = $.html()
    return metaTagHtml
}

function toShareTags(shareData) {
    return _.map(shareData, toShareTag)
}

module.exports = function (options) {
  options = options || {}
  if (!options.fallback) { throw new Error('Error (deeplink): options.fallback cannot be null') }
  options.android_package_name = options.android_package_name || ''
  options.ios_store_link = options.ios_store_link || ''
  options.title = options.title || ''

  var deeplink = function (req, res, next) {
    var opts = {}
    Object.keys(options).forEach(function (k) { opts[k] = options[k] })

    // bail out if we didn't get url
    if (!req.query.url) {
      return next()
    }
    opts.url = req.query.url

    if (req.query.fallback) {
      opts.fallback = req.query.fallback
    }

    opts.shareMetadata = opts.shareMetadata || []

    // read template file
    var file = fs.createReadStream(path.join(__dirname, '/public/index.html'))

    // replace all template tokens with values from options
    var detoken = new stream.Transform({ objectMode: true })
    detoken._transform = function (chunk, encoding, done) {
      var html = chunk.toString()
      Object.keys(opts).forEach(function (key) {
        html = html.replace('{{' + key + '}}', opts[key])
      })

      var $ = cheerio.load(html)
      var shareTags = toShareTags(opts.shareMetadata)
      $('head').append(shareTags)
      var htmlWithShareMetadata = $.html()

      this.push(htmlWithShareMetadata)
      done()
    }

    // inline template js with html
    var inline = inliner({ basedir: path.join(__dirname, '/public') })

    // make sure the page is being sent as html
    res.set('Content-Type', 'text/html;charset=utf-8')

    // read file --> detokenize --> inline js --> send out
    file.pipe(detoken).pipe(inline).pipe(res)
  }

  return deeplink
}
