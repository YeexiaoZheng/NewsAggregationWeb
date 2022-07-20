// import
const express = require('express')


// init
const app = express()
let hotSearch = {}      // 这里为了方便实现热搜直接定在服务器内，如果请求量大的话应该需要单独放入某一消息队列
const mysql = require('mysql')
const db = mysql.createConnection({
    host: "your.aliyuncs.com",
    database: "your database",
    port: 3306,
    user: "your username",
    password: "your password"
})
db.connect((err) => {
    if (err) {
        console.log('fail to connect db', err.stack)
        throw err;
    } else {
        console.log('connect to db successfully!')
    }
})


// 获得keywordsList和dataList
let keywordsList = []
let dataList = []
const getKeywordsList = () => {
    let keywords = []
    let keywordsDic = {}
    const keywordSQL = 'SELECT keywords FROM news'
    db.query(keywordSQL, (err, results) => {
        for (let i = 0; i < results.length; i++) {
            onekeys = results[i].keywords.trim()
            if (onekeys != '') {
                if (onekeys.includes(',')) {
                    onekeysList = onekeys.split(',')
                    for (let j = 0; j < onekeysList.length; j++) {
                        if (onekeysList[j].includes(' ')) {
                            temp = onekeysList[j].split(' ')
                            for (let k = 0; k < temp.length; k++) {
                                keywords.push(temp[k])
                            }
                        } else {
                            keywords.push(onekeysList[j])
                        }
                    }
                }
            }
        }
        for (let i = 0; i < keywords.length; i++) {
            if (keywords[i] in keywordsDic) {
                keywordsDic[keywords[i]] += 1
            } else {
                keywordsDic[keywords[i]] = 1
            }
        }
        for (key in keywordsDic) {
            keywordsList.push({
                name: key,
                value: keywordsDic[key]
            })
        }
        keywordsList.sort((a, b) => -(a.value - b.value))
        keywordsList = keywordsList.slice(0, 100)
    })
}
getKeywordsList()
const getDataList = () => {
    const dataSQL = 'SELECT source, COUNT(*)  FROM news GROUP BY source'
    db.query(dataSQL, (err, results) => {
        for (let i = 0; i < results.length; i++) {
            dataList.push({
                name: results[i]['source'],
                value: results[i]['COUNT(*)']
            })
        }
    })
}
getDataList()


// 定时执行爬虫相关并更新keywordsList和dataList
const websites = {
    wangyi: '网易新闻',
    xinlang: '新浪新闻',
    xinhua: '新华网',
    renmin: '人民网'
}
const wangyi = require('./crawler/websites/wangyi')
const xinlang = require('./crawler/websites/xinlang')
const renmin = require('./crawler/websites/renmin')
const xinhua = require('./crawler/websites/xinhua')
const crawler = require('./crawler/crawler')
const schedule = require('node-schedule');
let rule = new schedule.RecurrenceRule();
rule.hour = [0, 12]
rule.minute = 5
// schedule.scheduleJob(rule, () => {
//     crawler.seedGet(db, wangyi.formats, wangyi.newsGet)
//     crawler.seedGet(db, xinlang.formats, xinlang.newsGet)
//     crawler.seedGet(db, xinhua.formats, xinhua.newsGet)
//     crawler.seedGet(db, renmin.formats, remin.newsGet)
//     getKeywordsList()
//     getDataList()
// })


// router
// hot list api
app.get('/api.hotList/', (req, res) => {
    // 从hotSearch中获取热搜列表
    let hotList = []
    for (let k in hotSearch) {
        hotList.push({
            key: k,
            times: hotSearch[k]
        })
    }
    hotList.sort((a, b) => -(a.times - b.times))

    // 发送热搜列表
    res.send({
        hotList: hotList
    })
})

// 更新实时热搜
const updateHotSearch = (key) => {
    if (key in hotSearch) {
        hotSearch[key] += 1
    } else {
        hotSearch[key] = 1
    }
    if (hotSearch.length > 75) {
        let hotList = []
        for (let k in hotSearch) {
            hotList.push({
                key: k,
                times: hotSearch[k]
            })
        }
        hotList.sort((a, b) => -(a.times - b.times))
        for (let i = 50; i < hotSearch.length; i++) {
            delete hotSearch[hotList[i].key]
        }
    }
}

// search result api
app.get('/api.search/', (req, res) => {
    // 获得query内容
    const query = req.query
    console.log(query)

    // 根据key更新hotList
    if (query.page == 1) updateHotSearch(query.key)

    // 根据query内容在数据库中搜索相应的数据
    let searchSQL = 'SELECT url, title, summary, source FROM news WHERE '
    let searchParams = []

    let sourceCondition = ''
    for (let i = 0; i < query.source.length; i++) {
        temp = 'source = ?'
        if (sourceCondition != '') temp = ' or ' + temp
        sourceCondition += temp
        searchParams.push(websites[query.source[i]])
    }
    sourceCondition = '(' + sourceCondition + ')'

    const like = '%' + query.key + '%'
    let keyCondition = ''
    for (let i = 0; i < query.selection.length; i++) {
        temp = query.selection[i] + ' like ?'
        if (keyCondition != '') temp = ' or ' + temp
        keyCondition += temp
        searchParams.push(like)
    }
    keyCondition = '(' + keyCondition + ')'

    searchSQL += sourceCondition + ' and ' + keyCondition

    resultList = []
    db.query(searchSQL, searchParams, (err, results) => {
        if (results) {
            for (let i = 0; i < results.length; i++) {
                obj = results[i]
                resultList.push({
                    title: obj.title,
                    summary: obj.summary,
                    source: obj.source,
                    url: obj.url,
                })
            }
        }

        // 分页
        const perpage = 10
        let pageCount = parseInt((resultList.length - 1) / 10) + 1

        // 返回结果列表
        res.send({
            resultList: resultList.slice((query.page - 1) * perpage, query.page * perpage),
            pageCount: pageCount
        })
    })

})

// 展示数据api
app.get('/api.display/', (req, res) => {
    res.send({
        keywordsList: keywordsList,
        dataList: dataList
    })
})


// running
app.listen(8000, () => {
    console.log('express server running at http://127.0.0.1')
})


// static
// app.use('/static', express.static('xxx'))