const puppeteer = require('puppeteer');
const _ = require('lodash');
const { utils } = require('./utils');



async function action() {
  let page = null;
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      // devtools: true
    }); //打开浏览器
    page = await browser.newPage(); //打开一个空白页
    // await page.setRequestInterception(true);
    // await page.on('response', async response => {
    //   const req = response.request();

    // });

    // await page.on('request', async request => {
    //   if (request.url() === '') {

    //   } else {
    //     request.continue()
    //   }
    // });


    await page.goto('https://ssl.captcha.qq.com/cap_union_new_show'); //在地址栏输入网址并等待加载


    let au = new utils(page);
    await au.action();

  } catch (e) {

  }
}

module.exports = { action}


