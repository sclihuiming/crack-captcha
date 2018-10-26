const  jimp = require('jimp');
const _  = require('lodash');


class utils {
  constructor(page) {
    this.page = page;
    //滑块相对于窗口的位置
    this.btn_position = {
      btn_left: 0,
      btn_top: 0
    };
    this.resize = {
      full_width: 312,
      full_height: 183,
      icon_width: 62,
      icon_height: 62
    },
      this.similarPixDis = 2; //计算相似的像素空间距离
    this.diffPixDis = 8;// 计算落差的像素空间距离
    this.nums = 10;// 相似的点的个数
    this.iconToBackgroundDisX = 34;//icon初始相对于北京的距离
  }


  /**
   * 计算需要移动的距离
   * @param image 图片对象 jimp实例化
   * @param startX  图片的x坐标
   * @param startY  图片的y坐标
   * @param diffPixDis 计算差异化很大的空间像素标准值
   * @param similarPixDis 计算差异化很小的空间像素标准值
   * @param nums 相似次数
   * @returns {*}
   */
  _calMoveX(image, startX, startY, diffPixDis = this.diffPixDis, similarPixDis= this.similarPixDis, nums = this.nums) {
    let frontR = 0, frontG = 0, frontB = 0;
    let index = 0;
    let sameNum = 0;//相似次数
    let sameX = 0;//最终点
    let same = false;
    let info = [];//可能的坐标点集合
    let pointInfo = {};
    let tempWhite = [];

    //311是背景图片的大小   10是随意写的偏移值,(主要是缺块一般都是在右边)
    //todo 可以抽象为静态变量
    image.convolute([[-1, -1,-1], [-1, 8, -1], [-1, -1, -1]]); //图像卷积计算   Laplace因子
    image.scan(startX, startY, this.resize.full_width - startX - 5, this.resize.icon_height, function (x, y, idx) {
      let fullBitMap = this.bitmap.data;

      if(fullBitMap[idx]===255&&fullBitMap[idx+1]===255&&fullBitMap[idx+2]===255){
        tempWhite.push([x,y])
      }
      //对比当前点和上一个点的像素距离
      if (index > 2) {
        const res1 = Math.abs(fullBitMap[idx] - frontR);
        const res2 = Math.abs(fullBitMap[idx + 1] - frontG);
        const res3 = Math.abs(fullBitMap[idx + 2] - frontB);
        // console.log(x ,y, res1, res2, res3);
        let dis = Math.sqrt(res1 ^ 2 + res2 ^ 2 + res3 ^ 3);
        // console.log(dis)
        if (!same) {
          //100是因为缺块一般都在右边,也可以直接去掉这个判断
          if (dis > diffPixDis && x > 100) {
            same = true;
            sameX = x;
            // console.log(dis, x, y)
          } else {
            same = false;
            sameNum = 0;
            sameX = 0;
          }
        } else {
          //相似值判断
          if (dis <= similarPixDis) {
            // console.log(x, dis)
            sameNum++;
            if (sameNum > nums) {
              info.push(sameX);
              pointInfo[sameX] = pointInfo[sameX] || 1;
              pointInfo[sameX]++;
            }
          } else {
            same = false;
            sameNum = 0;
            sameX = 0;
          }
        }
      }
      frontR = fullBitMap[idx];
      frontG = fullBitMap[idx + 1];
      frontB = fullBitMap[idx + 2];
      index++;
    });

    // console.log(info)

    if (_.size(info) > 0) {
      info = _.sortBy(_.uniq(info));
      //验证info中的坐标
      let length = info.length;
      console.log('before', info)
      for (let i = length - 1; i >= 0; i--) {
        if ((i - 1) >= 0) {
          if (info[i] - info[i - 1] < 20) {//取最优
            info[i] = null;
          }
        }
      }
      console.log('after', info)
      console.log('new ', tempWhite)
      info = _.compact(info);
      return info[info.length - 1];
    } else {
      similarPixDis += 0.1;
      return this._calMoveX(image, startX, startY, diffPixDis, similarPixDis, nums);
    }
  }

  _sleep(delay) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(1)
        } catch (e) {
          reject(0)
        }
      }, delay);
    })
  };

  /**
   * 计算滑块位置
   */
  async _getBtnPosition() {
    return await this.page.evaluate(() => {
      const { left, top, width, height } = document.querySelector('#tcaptcha_drag_button').getBoundingClientRect()
      return { btn_left: Math.floor(width / 2 + left), btn_top: Math.floor(height / 2 + top) }
    });
  }

  /**
   * 尝试滑动按钮
   * @param distance 滑动距离
   * */
  async _tryValidation(distance) {
    console.log('dis', distance)
    //将距离拆分成两段，模拟正常人的行为
    const restDisMin = 20;
    const restDisMax = 50;
    let realRestDis = _.random(restDisMin, restDisMax);

    let moveArr = [{
      dis: distance - realRestDis,
      steps: _.random(20, 25)
    }, {
      dis: realRestDis,
      steps: _.random(8, 10)
    }];

    let start = this.btn_position.btn_left;
    let top = this.btn_position.btn_top;
    await this.page.mouse.move(start, top, { steps: 15 });
    await this.page.mouse.down();
    await this._sleep(_.random(500, 1000));


    for (let info of moveArr) {
      start += info.dis;
      await this.page.mouse.move(start, top, { steps: info.steps });
      await this._sleep(_.random(1000, 2000));
    }

    await this.page.mouse.up();
    await this._sleep(_.random(2500, 3500));

    //这里全部返回false,可以一直测试跑
    return { isSuccess: false };
  }


  /**
   * 拖动
   * @param {*} image  jimp图片
   * @param {*} startX 图片检测开始坐标
   * @param {*} startY  图片检测结束坐标
   */
  async _drag(image, startX, startY) {
    let distance = this._calMoveX(image, startX, startY);

    //distance代表的是缺口的横坐标点
    distance = distance - this.iconToBackgroundDisX;
    const result = await this._tryValidation(distance);
    console.log(result)
    if (result.isSuccess) {
      await this._sleep(1000);
      //登录
      // console.log('验证成功');
      this.page.click('#modal-member-login button')
    } else {
      // console.log('重新计算滑距离录，重新滑动');
      await this._sleep(3000);
      console.log('retry')
      await this.action()
    }
  }

  async action() {
    console.log('1111')
    await this._sleep(1000);
    console.log(3333)
    // 这里的根据页面的元素不同而改变, 只要能取到背景大图的url
    const url = await this.page.$eval('#slideBg', i => i.src);
    const iconUrl = await this.page.$eval('#slideBlock', i => i.src);
    //icon相对于背景的高度
    const top = parseInt(await this.page.$eval('#slideBlock', i => i.style.top));
    console.log(url)
    console.log(iconUrl)

    let fullImg = await jimp.read(url);
    let icon = await jimp.read(iconUrl);
    fullImg = await fullImg.resize(this.resize.full_width, this.resize.full_height);
    icon = await icon.resize(this.resize.icon_width, this.resize.icon_height);
    // await fullImg.writeAsync('full.png')
    // await icon.writeAsync('icon.png')

    //judge diff
    this.btn_position = await this._getBtnPosition();

    console.log(this.btn_position)

    //judge 大概计算一下大图是的宽是小图宽的多少倍
    let loop = Math.floor(this.resize.full_width / this.resize.icon_width);
    //62是icon的大小 一般缺口都是在右边,所以这里下面的可以视实际情况调整
    let startX = this.resize.full_width - (loop - 1) * this.resize.icon_width; //背景图的横轴开始像素点
    let startY = top - 1; //背景图的竖轴开始像素点

    let res = await this._drag(fullImg, startX, startY);
    console.log(res);
  }

}


module.exports = { utils };