// 用一个全局变量存储被注册的副作用函数
let activeEffect

// 存储副作用函数的桶
// weakMap 经常用于存储那些只有当 key 所引用的对象存在时（没有被回收）才有价值的信息
const bucket = new WeakMap()

// 原始数据
const data = { text: 'hello world' }

// effect 函数用于注册副作用函数
function effect (fn) {
  // 当调用 effect 注册副作用函数时，将副作用函数 fn 赋值给 activeEffect
  activeEffect = fn
  // 执行副作用函数
  fn()
}

// 代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get (target, key) {
    track(target, key)
    // 返回属性值
    return target[key]
  },
  // 拦截设置操作
  set (target, key, newVal) {
    // 设置属性值
    target[key] = newVal
    // 把副作用函数从桶内取出并执行
    trigger(target, key)
    return true
  }
})

// 在 get 拦截函数内调用 track 函数追踪变化
function track (target, key) {
  // 没有 activeEffect，直接 return
  if (!activeEffect) return
  // 根据 target 从“桶”中取的 depsMap，它也是个 Map 类型：key -> effects
  let depsMap = bucket.get(target)
  // 如果不存在 depsMap，那么新建一个 Map 并与 target 关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }

  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  // 将当前激活的副作用函数添加到桶内
  deps.add(activeEffect)
}

// 在 set 中拦截函数内调用 trigger 函数触发变化
function trigger (target, key) {
  // 根据 target 从桶中取出 depsMap，它是 key -> effects
  const depsMap = bucket.get(target)

  if (!depsMap) return
  // 根据 key 取的所有副作用函数 effects
  const effects = depsMap.get(key)
  // 执行副作用函数
  effects && effects.forEach(fn => fn())
}