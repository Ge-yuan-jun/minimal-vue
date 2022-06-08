// 用一个全局变量存储被注册的副作用函数
let activeEffect
// effect 栈
const effectStack = []

// 存储副作用函数的桶
// weakMap 经常用于存储那些只有当 key 所引用的对象存在时（没有被回收）才有价值的信息
const bucket = new WeakMap()

// 原始数据
const data = { foo: 1, bar: 2 }

// effect 函数用于注册副作用函数
function effect (fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    // 调用 effect 注册副作用函数时，将副作用函数赋值给 activeEffect
    activeEffect = effectFn
    // 在调用副作用函数执行之前将当前副作用函数压入栈中
    effectStack.push(effectFn)
    const res = fn()
    // 在当前副作用函数执行完毕后，弹出栈，并将 activeEffect 还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    
    return res
  }
  effectFn.options = options
  // activeEffects.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = []
  if (!options.lazy) {
    // 执行副作用函数
    effectFn()
  }
  // 如果带有 lazy 标志，则将函数返回，交于业务方执行
  return effectFn
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

  // deps 就是一个与当前副作用函数存在联系的依赖几个
  // 将其添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps) // 新增
}

// 在 set 中拦截函数内调用 trigger 函数触发变化
function trigger (target, key) {
  // 根据 target 从桶中取出 depsMap，它是 key -> effects
  const depsMap = bucket.get(target)

  if (!depsMap) return
  // 根据 key 取的所有副作用函数 effects
  const effects = depsMap.get(key)
  // 执行副作用函数
  const effectsToRun = new Set()
  effects && effects.forEach(effectFn => {
    // 如果 trigger 触发的副作用函数与当前正在执行的副作用函数相同，则不触发执行
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })

  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      // 如果存在调度器，则将副作用函数作为参数传递
      effectFn.options.scheduler(effectFn)
    } else {
      // 默认行为
      effectFn()
    }
  })
}

function cleanup (effectFn) {
  // 遍历 effectFn.deps 数组
  for (let i = 0; i < effectFn.deps.length; i++) {
    // deps 是依赖集合
    const deps = effectFn.deps[i]
    // 将effectFn 从依赖集合中移除
    deps.delete(effectFn)
  }
  // 最后需要重置 effectFn.deps 数组
  effectFn.deps.length = 0
}

//----------------------------

// 实现 computed
function computed (getter) {
  // 缓存上一次计算的值
  let value
  // dirty: true 表示需要重新计算
  let dirty = true

  const effectFn = effect(getter, {
    lazy: true,
    scheduler () {
      if (!dirty) {
        dirty = true
        trigger(obj, 'value')
      }
    }
  })

  const obj = {
    // 只有读取的时候才会触发执行 effectFn
    get value () {
      if (dirty) {
        value = effectFn()
        dirty = false
      }
      track(obj, 'value')
      return value
    }
  }

  return obj
}

const sumRes = computed(() => obj.foo + obj.bar)

console.log(sumRes.value)

obj.foo++

console.log(sumRes.value)