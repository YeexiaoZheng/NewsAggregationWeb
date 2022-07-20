require('date-utils');
const iconv = require('iconv-lite')
const requestDefault = require('request')
const cheerio = require('cheerio');


// 网站相关
// const source = '中国新闻网'
// const seedURL = 'http://www.chinanews.com/'
// const encoding = 'utf-8'

// const seedURL_format = "$('a')"
// const url_reg = /\/(\d{4})\/(\d{2})-(\d{2})\/(\d{7})\.shtml/
// const title_format = "$('title').text()"
// const keywords_format = " $('meta[name=\"keywords\"]').eq(0).attr(\"content\")"
// const author_format = "$('#author_baidu').text()"
// const summary_format = " $('meta[name=\"description\"]').eq(0).attr(\"content\")"
// const content_format = "$('.left_zw').text()"

// const date_format = "$('#pubtime_baidu').text()"
// const regExp = /((\d{4}|\d{2})(\-|\/|\.)\d{1,2}\3\d{1,2})|(\d{4}年\d{1,2}月\d{1,2}日)/

const source = '网易新闻'
const seedURL = 'https://news.163.com/'
const encoding = 'utf-8'

const seedURL_format = "$('a')"
const url_reg = /\/news\/article\/[a-zA-Z0-9]+.html/
const title_format = "$('title').text()"
const keywords_format = " $('meta[name=\"keywords\"]').eq(0).attr(\"content\")"
const author_format = "$('.post_author').text()"
const summary_format = " $('meta[name=\"description\"]').eq(0).attr(\"content\")"
const content_format = "$('.post_body').text()"

const date_format = "$('.post_info').text()"
const regExp = /((\d{4}|\d{2})(\-|\/|\.)\d{1,2}\3\d{1,2})|(\d{4}年\d{1,2}月\d{1,2}日)/

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


// 初始化数据库相关
const mysql =  require('mysql')
const db = mysql.createConnection({
    host: "rm-uf6sa4z821ggi2v068o.mysql.rds.aliyuncs.com",
    database: "webnews",
    port: 3306,
    user: "zyx",
    password: "zyx_1234"
});
db.connect((err) => {
    if (err){
        console.log('fail to connect db', err.stack)
        throw err;
    } else {
        console.log('connect to db successfully!')
    }
})


// 伪装headers 防止网站屏蔽我们的爬虫
const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.65 Safari/537.36'
}
// 异步request
const request = (url, callback) => {
    const options = {
        url: url,
        encoding: null,
        //proxy: 'http://x.x.x.x:8080',
        headers: headers,
        timeout: 10000 
    }
    requestDefault(options, callback)
}


// 种子页面处理
const seedGet = (db, formats) => {
    request(formats.seedURL, (err, res, body) => {
        const html = iconv.decode(body, formats.encoding);
        const $ = cheerio.load(html, { decodeEntities: true })
        let seed_as;
        try {
            seed_as = eval(formats.seedURL_format);
        } catch (e) { 
            console.log('url列表所处的html块识别出错: ' + e) 
        }
        console.log(seed_as.length)
        // 遍历种子页面里所有的a链接
        seed_as.each((i, e) => { 
            // 获得新闻url并判断是否匹配正则
            let myURL = "";
            try {
                const href = $(e).attr("href")
                if (href == undefined) return
                if (href.toLowerCase().indexOf('http://') >= 0) myURL = href        // http://开头的
                else if (href.toLowerCase().indexOf('https://') >= 0) myURL = href  // https://开头的
                else if (href.startsWith('//')) myURL = 'http:' + href              // //开头的
                else myURL = formats.seedURL.substr(0, formats.seedURL.lastIndexOf('/') + 1) + href // 其他

            } catch (e) { 
                console.log('识别种子页面中的新闻链接出错：' + e) 
            }
            if (!url_reg.test(myURL)) return;

            // 如果此url不在数据库中则调用方法添加此url相关的页面
            const SQL = 'SELECT url FROM news WHERE url=?';
            const params = [myURL];
            db.query(SQL, params, (qerr, vals, fields) => {
                if (vals.length > 0) console.log('URL duplicate!')
                else newsGet(myURL, formats)
            });
        });
    })


}
seedGet(db, formats)


//读取新闻页面
const newsGet = (url) => { 
    request(url, (err, res, body) => {
        const html_news = iconv.decode(body, encoding)
        const $ = cheerio.load(html_news, { decodeEntities: true })

        // 动态执行format字符串，构建json对象准备写入文件或数据库
        let news = {
            url: url, source: source, encoding: encoding,
            title: '', keywords: '', author: '',
            summary: '', content: '',
            publishDate: (new Date()).toFormat("YYYY-MM-DD"),
            crawlTime: (new Date()).toFormat('YYYY-MM-DD HH24:MI:SS'),
        }

        // 标题
        if (title_format == '') news.title = ''
        else news.title = eval(title_format)
        // 关键词
        if (keywords_format == '') news.keywords = source      // 没有关键词则使用source
        else news.keywords = eval(keywords_format)
        // 作者
        if (author_format == '') news.author = source          // 没有作者则使用source
        // else news.author = eval(author_format).replace('作者：', '')
        else news.author = eval(author_format).split('责任编辑：').pop().replace('\n', '').trim()
        // 摘要
        if (summary_format == '') news.summary = news.title   // 没有摘要则使用title
        else news.summary = eval(summary_format).replace('\r\n', '')
        // 内容
        if (content_format == '') news.content = ''            // 没有内容就设置为空
        else news.content = eval(content_format).replace('\r\n' + news.author, '')
        // 刊登日期
        if (date_format != '') news.publishDate = eval(date_format)
        if (!news.publishDate) return
        news.publishDate = regExp.exec(news.publishDate)[0]
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



// const time = (new Date()).toFormat('YYYY-MM-DD HH24:MI:SS')

// const insertSQL = 'INSERT INTO news(url, source, encoding, title, keywords, \
//     author, summary, content, publishDate, crawlTime) VALUES(?,?,?,?,?,?,?,?,?,?)'
// const insertParams = ['https://www.chinanews.com.cn/gn/2022/07-19/9806780.shtml', '中国新闻网', 'utf-8', 
// '公安部：严查寻衅滋事、打架斗殴 严防个人极端暴力案事件-中新网', '巡控,安全阀,社会治安,违法犯罪,烟火气', 'chinanews',
// '据公安部网站消息，公安部部署在“百日行动”中进一步加强城乡社会治安巡控，要求严防发生个人极端暴力案事件，严查快处寻衅滋事、打架斗殴、故意伤害等违法犯罪活动。对寻衅滋事、打架斗殴、故意伤害等违法犯罪活动，特别是侵害妇女、儿童、学生、老年人、残疾人等群体的，要依法严查快处。',
// 'content', '2022-7-19', time
// ]
// console.log(insertParams.length)

// db.query(insertSQL, insertParams, (qerr, vals, fields) => {
//     if (qerr) console.log(qerr);
// })
