// 存储副作用函数的桶
const bucket: Set<Function> = new Set()

// 原始数据
const data = { text: 'hello world' }

function effect () {
  document.body.innerText = obj.text
}

// 代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get (target, key) {
    // 添加副作用函数至桶内
    bucket.add(effect)
    // 返回属性值
    return target[key]
  },
  // 拦截设置操作
  set (target, key, newVal) {
    // 设置属性值
    target[key] = newVal
    // 把副作用函数从桶内去除并执行
    bucket.forEach(fn => fn())
    // 返回 true 表示设置操作成功
    return true
  }
})