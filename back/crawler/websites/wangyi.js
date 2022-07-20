const common = require('../common')
const iconv = require('iconv-lite')
const cheerio = require('cheerio');

const formats = {
    source: '网易新闻',
    seedURL: 'https://news.163.com/',
    encoding: 'utf-8',

    seedURL_format: "$('a')",
    url_reg: /\/news\/article\/[a-zA-Z0-9]+.html/,
    title_format: "$('title').text()",
    keywords_format: "$('meta[name=\"keywords\"]').eq(0).attr(\"content\")",
    author_format: "$('.post_author').text()",
    summary_format: " $('meta[name=\"description\"]').eq(0).attr(\"content\")",
    content_format: "$('.post_body').text()",

    date_format: "$('.post_info').text()",
    regExp: /((\d{4}|\d{2})(\-|\/|\.)\d{1,2}\3\d{1,2})|(\d{4}年\d{1,2}月\d{1,2}日)/
}


//读取新闻页面
const newsGet = (db, url) => { 
    common.request(url, (err, res, body) => {
        const html_news = iconv.decode(body, formats.encoding)
        const $ = cheerio.load(html_news, { decodeEntities: true })

        // 动态执行format字符串，构建json对象准备写入文件或数据库
        let news = {
            url: url, source: formats.source, encoding: formats.encoding,
            title: '', keywords: '', author: '',
            summary: '', content: '',
            publishDate: (new Date()).toFormat("YYYY-MM-DD"),
            crawlTime: (new Date()).toFormat('YYYY-MM-DD HH24:MI:SS'),
        }

        // 标题
        if (formats.title_format == '') news.title = ''
        else news.title = eval(formats.title_format)
        // 关键词
        if (formats.keywords_format == '') news.keywords = formats.source      // 没有关键词则使用source
        else news.keywords = eval(formats.keywords_format)
        // 作者
        if (formats.author_format == '') news.author = formats.source          // 没有作者则使用source
        else news.author = eval(formats.author_format).split('责任编辑：').pop().replace('\n', '').trim()
        // 摘要
        if (formats.summary_format == '') news.summary = news.title   // 没有摘要则使用title
        else news.summary = eval(formats.summary_format).replace('\r\n', '')
        // 内容
        if (formats.content_format == '') news.content = ''            // 没有内容就设置为空
        else news.content = eval(formats.content_format).replace('\r\n' + news.author, '')
        // 刊登日期
        if (formats.date_format != '') news.publishDate = eval(formats.date_format)
        if (!news.publishDate) return
        news.publishDate = formats.regExp.exec(news.publishDate)[0]
        news.publishDate = news.publishDate.replace('年', '-').replace('月', '-').replace('日', '')
        news.publishDate = new Date(news.publishDate).toFormat("YYYY-MM-DD")

        const insertSQL = 'INSERT INTO news(url, source, encoding, title, keywords, \
            author, summary, content, publishDate, crawlTime) VALUES(?,?,?,?,?,?,?,?,?,?)'
        
        const insertParams = [
            news.url, news.source, news.encoding, news.title, news.keywords,
            news.author, news.summary, news.content, news.publishDate, news.crawlTime
        ]

        // 执行sql，数据库中news表里的url属性是unique的，不会把重复的url内容写入数据库
        db.query(insertSQL, insertParams, (qerr, vals, fields) => {
            if (qerr) console.log(qerr)
            else console.log('successfully fetched: ', url)
        })
    })
}

module.exports = { formats, newsGet }