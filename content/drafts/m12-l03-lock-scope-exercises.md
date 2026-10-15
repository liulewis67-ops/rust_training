# M12-L03 短练习：读写锁与 guard 范围

## 1. 预测：哪个 guard 会让写锁无法取得？

```rust
use std::sync::{Mutex, RwLock, TryLockError};

let mutex = Mutex::new(1);
let mutex_guard = mutex.lock().unwrap();
let mutex_attempt = mutex.try_lock();
drop(mutex_guard);
let mutex_after_drop = mutex.try_lock();

let rw = RwLock::new(2);
let reader_a = rw.read().unwrap();
let reader_b = rw.read().unwrap();
let writer_attempt = rw.try_write();
drop(reader_a);
let writer_still_blocked = rw.try_write();
drop(reader_b);
let writer_after_readers = rw.try_write();
```

预测每个 try 方法是成功、WouldBlock 还是可能毒化错误；说明为什么 drop(reader_a) 后独占写仍不能开始，以及 RwLock 相比 Mutex 增加了什么并发读能力。

**分层提示**

1. Mutex guard 活着时，不区分读写，一次只能一个 guard。
2. RwLock 同时允许多个读者；释放其中一个读者后另一个仍在读。
3. 全部 reader 释放后 try_write 才可取得写 guard。

## 2. 修复：缩短读 guard，同时保留并发下的正确性

```rust
use std::sync::RwLock;

fn set_default_if_empty(state: &RwLock<Option<String>>, candidate: String) -> bool {
    let current = state.read().unwrap();
    if current.is_none() {
        let mut writer = state.write().unwrap();
        *writer = Some(candidate);
        return true;
    }
    false
}
```

说明该实现为什么会在从读锁升级写锁的位置阻塞。改写函数，使空值时只设置一次、已有值不被覆盖；不要用 try_write 失败就返回 false 作为最终修复，因为那会让本该成功的初始化丢失。必须释放读 guard 后再申请写 guard，并在写 guard 内复查。

**分层提示**

1. 把 `current.is_none()` 结果提取到一个内层读作用域。
2. 读 guard 离开作用域后再申请 write guard。
3. 两把锁之间可能被其它线程写入；写锁内重新检查 Option 再决定是否设置。

## 3. 补测试：验证读者共存、writer 独占和作用域修复

为 `RwLock<Option<String>>` 补测试，断言：两个 read guard 可同时存在；两者任一仍存在时 `try_write` 返回 WouldBlock；释放全部 reader 后 `try_write` 可取得写锁。测试 `set_default_if_empty` 时第一次设置成功，第二次调用不覆盖旧值。再为 Mutex 补一个 guard 活着时 try_lock WouldBlock、drop 后成功的断言。

不要用 sleep、线程调度时间窗或阻塞式重入取代 guard 关系断言。

**分层提示**

1. 同一线程里保留两个 read guard 就可确定性检查共享读，不用起线程。
2. 使用 `matches!(..., Err(TryLockError::WouldBlock))` 区分锁正忙的情况。
3. 用不同候选值第二次调用初始化函数，断言原值保持不变；这能发现缺少独占锁内复查的实现。
