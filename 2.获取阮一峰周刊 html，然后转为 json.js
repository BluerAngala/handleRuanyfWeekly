// 使用 axios 和 cheerio 抓取网页内容，并将其转换为 JSON 结构
// 解析 阮一峰周刊 为标准化 json 数据结构 

// 引入 axios 和 cheerio 库
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// 定义一个常规的二级标题列表，方便提取文章结构
const normalTitleList = [
    '科技动态',
    '文章',
    '工具',
    'AI 相关',
    '资源',
    '图片',
    '言论',
    '往年回顾'
];

// 定义一个函数来抓取和解析网页
async function fetchAndConvertToJSON(url) {
    try {
        // 使用 axios 抓取网页内容
        const { data } = await axios.get(url);

        // 使用 cheerio 加载 HTML 内容
        const $ = cheerio.load(data);

        // 获取文章标题
        const title = $('h1').text().trim();

        // 获取文章日期
        const date = $('.asset-meta abbr').text().trim();

        // 获取封面图
        const cover = $('#main-content > p > img').first().attr('src');

        /**
         * 处理二级标题和三级标题的内容
         * @param {string} h2 - 二级标题
         * @param {string} h2Next - 二级标题的下一个元素
         * @returns {array} - 处理后的二级标题和三级标题的内容
         */
        function processSections(h2, h2Next) {

            // 如果二级标题不在 normalTitleList 中，则直接返回 h2Next 的内容
            if (!normalTitleList.includes(h2)) {
                return h2Next.map((_, el) => $(el).toString()).get().join('');
            }

            const sections = [];
            let currentItem = null;

            h2Next.each((i, e) => {
                const $e = $(e);
                const htmlContent = $e.html().trim();
                const h3reg = /^([\d一二三四五六七八九十]+、)/;

                if (h3reg.test(htmlContent)) {
                    const h3Match = htmlContent.match(/<a href="([^"]+)">([^<]+)<\/a>/);
                    currentItem = {
                        title: h3Match ? h3Match[2] : '',
                        href: h3Match ? h3Match[1] : '',
                        content: htmlContent
                    };
                    sections.push(currentItem);
                } else {
                    if (currentItem) {
                        currentItem.content += htmlContent;
                    } else {
                        sections.push({ content: htmlContent });
                    }
                }
            });


            // 如果标题是文字，需要进行特别
            if (h2 === '文字' || h2 === '言论') {
                // 遍历sections，根据已有的content提取内容
                sections.forEach(section => {
                    // 使用正则表达式同时提取 title、href 和 source
                    const match = section.content.match(/^(?:[\d一二三四五六七八九十]+[、.\s]*)?([^--]+)--.*?<a href="([^"]+)">([^<]+)<\/a>/);

                    if (match) {
                        section.title = match[1].trim() || '';  // 提取并去除空格
                        section.href = match[2] || '';          // 提取 href
                        section.source = match[3].trim() || ''; // 提取 source
                    }
                });
            }


            // 如果二级标题是 往年回顾，则需要进行特别处理
            if (h2 === '往年回顾') {
                const result = sections.map(item => {
                    const match = item.content.match(/<a href="([^"]+)">([^<]+)<\/a>（(\d{4}) #(\d+)）/);

                    // 如果匹配成功，提取 title、href、year 和 issue
                    if (match) {
                        return {
                            "title": match[2].trim(),
                            "href": match[1],
                            "year": parseInt(match[3]),
                            "issue": parseInt(match[4]),
                            "content": item.content
                        };
                    }
                }).filter(Boolean);  //过滤掉未匹配到的内容

                return result;

            }

            return sections;
        }

        const result = { title, date, cover };
        $('#main-content > h2').each((i, e) => {
            const h2 = $(e).text().trim();
            const h2Next = $(e).nextUntil('h2');

            result[h2] = processSections(h2, h2Next);
        });

        return result;
    } catch (error) {
        console.error(`抓取页面时出错: ${error}`);
        throw error;
    }
}

// 获取所有周刊的链接
async function fetchAllWeeklyLinks() {
    try {
        const url = 'https://www.ruanyifeng.com/blog/weekly/';
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const links = $('#alpha-inner > div > div > ul > li > a').map((i, e) => $(e).attr('href')).get();


        return links;
    } catch (error) {
        console.error('获取所有周刊的链接时出错:', error);
        throw error;
    }

}

async function main() {
    try {
        // 获取所有周刊的链接
        const allWeeklyLinks = await fetchAllWeeklyLinks();
        console.log(`获取到 ${allWeeklyLinks.length} 条周刊链接~`);

        // 创建 weekly 文件夹
        const weeklyDir = path.join(__dirname, 'weekly');
        if (!fs.existsSync(weeklyDir)) {
            fs.mkdirSync(weeklyDir);
        }

        for (let i = 0; i < allWeeklyLinks.length; i++) {
            const weeklyLink = allWeeklyLinks[i];
            console.log(`正在处理第 ${i + 1} 条周刊链接: ${weeklyLink}`);
            const jsonData = await fetchAndConvertToJSON(weeklyLink);
            // console.log(jsonData);


            // 将保存名称进行处理，去掉特殊字符，非法字符等可能导致文件名不合法的字符
            const saveName = jsonData.title.replace(/[\\/:*?"<>|]/g, '_');
            const savePath = path.join(weeklyDir, `${saveName}.json`);
                        
            // 将 jsonData 写入文件
            fs.writeFileSync(savePath, JSON.stringify(jsonData, null, 2));
            console.log(`已保存到 ${savePath}`);

            // 休眠 1 秒
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

    } catch (error) {
        console.error('程序执行出错:', error);
        // throw error;
    }


    // // 调用函数并打印结果
    // const url = 'https://www.ruanyifeng.com/blog/2024/10/weekly-issue-321.html';



    // fetchAndConvertToJSON(url)
    //     .then(jsonData => {
    //         console.log(JSON.stringify(jsonData, null, 2));
    //     })
    //     .catch(error => {
    //         console.error('程序执行出错:', error);
    //     });

}

main();