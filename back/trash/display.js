const getKeywordsList = (db) => {
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
        let keywordsList = []
        for (key in keywordsDic) {
            keywordsList.push({
                name: key,
                value: keywordsDic[key]
            })
        }
        keywordsList.sort((a, b) => -(a.value - b.value))
        keywordsList = keywordsList.slice(0, 100)
        return keywordsList
    })
}

const getDataList = (db) => {
    const dataSQL = 'SELECT source, COUNT(*)  FROM news GROUP BY source'
    let dataList = []

    db.query(dataSQL, (err, results) => {
        for (let i = 0; i < results.length; i++) {
            dataList.push({
                name: results[i]['source'],
                value: results[i]['COUNT(*)']
            })
        }
        return dataList
    })
}

module.exports = { getKeywordsList, getDataList }