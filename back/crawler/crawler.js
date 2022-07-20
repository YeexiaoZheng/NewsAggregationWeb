require('date-utils');
const iconv = require('iconv-lite')
const cheerio = require('cheerio');
const common = require('./common')


// 种子页面处理
const seedGet = (db, formats, newsGet) => {
    common.request(formats.seedURL, (err, res, body) => {
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
            if (!formats.url_reg.test(myURL)) return;

            // 如果此url不在数据库中则调用方法添加此url相关的页面
            const SQL = 'SELECT url FROM news WHERE url=?';
            const params = [myURL];
            db.query(SQL, params, (qerr, vals, fields) => {
                if (vals.length > 0) console.log('URL duplicate!')
                else newsGet(db, myURL)
            });
        });
    })
}


module.exports = { seedGet }