# M03-L01：练习——结构体、字段与方法

## 1. 预测：读取与修改方法

```rust
/// Stores width and height for a panel.
struct Panel {
    width: u16,
    height: u16,
}

/// Provides area and width-update operations for a panel.
impl Panel {
    /// Returns the panel's area.
    fn area(&self) -> u32 {
        u32::from(self.width) * u32::from(self.height)
    }

    /// Changes the panel width.
    fn set_width(&mut self, width: u16) {
        self.width = width;
    }
}

/// Prints area before and after a method updates the width.
fn main() {
    let mut panel = Panel {
        width: 7,
        height: 3,
    };
    println!("{}", panel.area());
    panel.set_width(5);
    println!("{} {}", panel.width, panel.area());
}
```

预测两行输出，并说明为什么 `area` 可通过不可变借用调用、而 `set_width` 需要可变实例。

**契约：** 输出依次为 `21` 和 `5 15`；答案要区分读取实例与修改实例。

**分层提示：** ① 先算初始面积。② 更新后高度保持不变。③ 比较两个方法的接收者。

## 2. 修复：让结构体和方法调用匹配签名

```rust
/// Stores a pair of dimensions.
struct Canvas {
    width: u16,
    height: u16,
}

/// Replaces the canvas width.
impl Canvas {
    /// Updates the width field.
    fn set_width(&mut self, width: u16) {
        self.width = width;
    }
}

/// Attempts to update and print a canvas.
fn main() {
    let canvas = Canvas {
        width: "4",
        height: 3,
    };
    canvas.set_width();
    println!("{} {}", canvas.width, canvas.height);
}
```

修复编译错误，使程序打印 `4 3`。保留字段类型、方法签名和更新行为；说明实例绑定和方法参数各需怎样满足调用契约。

**契约：** `width` 保持 `u16`；将字符串字面量改成正确整数，并提供 `set_width` 所需的新值。实例需允许可变借用。

**分层提示：** ① 对照字段声明和实例表达式。② `&mut self` 的方法要求什么样的接收者？③ 方法除了接收者还声明了几个参数？

## 3. 实现：面板的面积与方向判断

为 `Panel` 实现两个方法：`area(&self) -> u32` 返回宽乘高；`is_wider(&self) -> bool` 当且仅当宽度严格大于高度时返回 `true`。字段都是 `u16`。

```rust
/// Stores a panel's dimensions.
struct Panel {
    width: u16,
    height: u16,
}

/// Defines calculations for panels.
impl Panel {
    /// TODO: return the area without narrowing either dimension.
    fn area(&self) -> u32 {
        todo!()
    }

    /// TODO: report whether width is strictly greater than height.
    fn is_wider(&self) -> bool {
        todo!()
    }
}
```

**契约：** `(8, 3)` 面积为 `24` 且更宽；`(4, 4)` 面积为 `16` 且不算更宽；`(2, 7)` 面积为 `14` 且不算更宽。最大字段值下的面积也必须正确。

**分层提示：** ① 方法通过 `self` 读取字段。② 乘法前检查结果类型范围。③ “严格大于”与“大于或等于”在相等边界结果不同。

## 参考答案

### 1. 预测

输出为 `21`，再输出 `5 15`。`area` 通过 `&self` 读取字段；`set_width` 通过 `&mut self` 修改宽度。

### 2. 修复

```rust
/// Stores a pair of dimensions.
struct Canvas { width: u16, height: u16 }
/// Replaces the canvas width.
impl Canvas {
    /// Updates the width field.
    fn set_width(&mut self, width: u16) { self.width = width; }
}
/// Updates and prints a canvas.
fn main() {
    let mut canvas = Canvas { width: 4, height: 3 };
    canvas.set_width(4);
    println!("{} {}", canvas.width, canvas.height);
}
```

字符串 `"4"` 与 `u16` 不匹配；接收者需要可变绑定，且调用必须提供宽度参数。

### 3. 实现

```rust
/// Stores a panel's dimensions.
struct Panel { width: u16, height: u16 }
/// Defines calculations for panels.
impl Panel {
    /// Returns the exact area of the panel.
    fn area(&self) -> u32 { u32::from(self.width) * u32::from(self.height) }
    /// Reports whether the panel is strictly wider than it is tall.
    fn is_wider(&self) -> bool { self.width > self.height }
}
```

两个 `u16` 最大值的乘积仍在 `u32` 范围内；相等时严格大于判断返回 `false`。
