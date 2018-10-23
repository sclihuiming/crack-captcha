import * as jimp from 'jimp';
import * as _ from 'lodash';


class utils {

  constructor(page) {
    this.page = page;
    this.btn_position = {};
  }

  /**
   * 计算需要移动的距离
   * @param image 图片对象 jimp实例化
   * @param pointx  图片的x坐标
   * @param pointy  图片的y坐标
   * @param firstPixDis 计算差异化很大的空间像素标准值
   * @param secondPixDis 计算差异化很小的空间像素标准值
   * @param times 相似次数
   * @returns {*}
   */
  _calMoveX(image, pointx, pointy, firstPixDis, secondPixDis, times) {
    let frontR = 0, frontG = 0, frontB = 0;
    let index = 0;

    let sameNum = 0;//相似次数
    let sameX = 0;//最终点

    let same = false;
    let info = [];//可能的坐标点集合

    //311是背景图片的大小   10是随意写的偏移值,(主要是缺块一般都是在右边)
    //todo 可以抽象为静态变量
    image.scan(pointx, pointy, 311 - pointx - 10, 62, function (x, y, idx) {
      let fullBitMap = this.bitmap.data;

      if (index > 2) {
        const res1 = Math.abs(fullBitMap[idx] - frontR);
        const res2 = Math.abs(fullBitMap[idx + 1] - frontG);
        const res3 = Math.abs(fullBitMap[idx + 2] - frontB);
        // console.log(x ,y, res1, res2, res3);
        let dis = Math.sqrt(res1 ^ 2 + res2 ^ 2 + res3 ^ 3);
        // console.log(dis)
        if (!same) {
          //100是因为缺块一般都在右边,也可以直接去掉这个判断
          if (dis > firstPixDis && x > 100) {
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
          if (dis <= secondPixDis) {
            // console.log(x, dis)
            sameNum++;
            if (sameNum > times) {
              info.push(sameX);
              same = false;
              sameNum = 0;
              sameX = 0;
            }
          } else {
            same = false;
          }
        }
      }
      frontR = fullBitMap[idx];
      frontG = fullBitMap[idx + 1];
      frontB = fullBitMap[idx + 2];
      index++;
    });

    if (_.size(info) > 0) {
      info = _.sortBy(_.uniq(info));
      //验证info中的坐标
      let length = info.length;
      console.log('before', info)
      for (let i = length - 1; i >= 0; i--) {
        if ((i - 1) >= 0) {
          if (info[i] - info[i - 1] < 30) {//取最优
            info[i] = null;
          }
        }
      }
      console.log('after', info)
      info = _.compact(info);
      return info[info.length - 1];
    } else {
      secondPixDis += 0.1;
      return this._calMoveX(image, pointx, pointy, firstPixDis, secondPixDis, times);
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


    return { isSuccess: false };
  }


  async _drag(image, pointx, pointy, firstPixDis, secondPixDis, times) {
    let distance = this._calMoveX(image, pointx, pointy, firstPixDis, secondPixDis, times);
    distance = distance - 34;
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
    const url = await this.page.$eval('#slideBg', i => i.src);
    const iconUrl = await this.page.$eval('#slideBlock', i => i.src);
    //icon相对于背景的高度
    const top = parseInt(await this.page.$eval('#slideBlock', i => i.style.top));
    console.log(url)
    console.log(iconUrl)

    let full = await jimp.read(url);
    let icon = await jimp.read(iconUrl);
    full = await full.resize(312, 183);
    icon = await icon.resize(62, 62);
    await full.writeAsync('full.png')
    await icon.writeAsync('icon.png')
    //judge
    let loop = Math.floor(312 / 62);
    let res = '';

    //judge diff
    this.btn_position = await this._getBtnPosition();

    console.log(this.btn_position)

    //62是icon的大小
    let x = 311 - (loop - 1) * 62;
    let y = top - 1;
    let firstPixDis = 8;//默认像素空间距离
    let secondPixDis = 2;
    res = await this._drag(full, x, y, firstPixDis, secondPixDis, 10);
    console.log(res);
  }

}


export { utils };