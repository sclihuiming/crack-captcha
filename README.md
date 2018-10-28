# crack-captcha

* 使用puppeteer模拟用户操作滑动验证码
* 使用jimp进行图片的解析,识别出缺口,计算需要滑动的距离

## 运行方法
```bash
$ git clone git@github.com:sclihuiming/crack-captcha.git
$ cd crack-captcha
$ npm install
$ npm start
```
⚠️ **注意:** npm install时需要注意Chromium下载是否成功,如果失败,需要重试,和网络环境有关