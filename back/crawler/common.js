const requestDefault = require('request')


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

module.exports = { request }