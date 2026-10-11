import type { Lesson } from '../types/lesson'
import { advancedLessons } from './advancedLessons'

const mc = (id: string, prompt: string, options: string[], correctAnswer: number, tags: string[], explanation: string, rule: string, code?: string, temptingWrong?: string, comparison?: string) => ({ id, type: 'code_prediction' as const, prompt, options, correctAnswer, tags, explanation, rule, code, temptingWrong, comparison })
const concept = (id: string, prompt: string, options: string[], correctAnswer: number, tags: string[], explanation: string, rule: string) => ({ id, type: 'multiple_choice' as const, prompt, options, correctAnswer, tags, explanation, rule })

export const lessons: Lesson[] = [
  {
    id: 'ownership', order: 1, title: '所有权 Ownership', category: 'Ownership', difficulty: 'beginner', estimatedMinutes: 8,
    objective: '理解值由谁负责，以及 move 如何让资源的生命周期明确且唯一。',
    explanation: 'Rust 的所有权规则回答的是“谁负责这个值的生命周期”。每个值在任一时刻有一个 owner；owner 离开作用域时，值会被 drop。把 String 赋给另一个变量会移动所有权，避免两个变量都认为自己该释放同一块堆内存。像 i32 这样实现 Copy 的简单类型会按位复制，因此原变量仍可用。',
    mentalModel: { description: 'Java / Go 通常由 GC 跟踪可达对象；Rust 在编译期确定 owner，并在作用域结束时执行 Drop。', before: 'a ──owns──▶ String\n                 │\n                 ▼\n            Heap "hello"', after: 'a ──▶ moved / unavailable\nb ──owns──▶ String ──▶ Heap "hello"' },
    examples: [{ language: 'rust', label: 'String move 与 Copy', code: 'let request = String::from("run tool");\nlet queued = request;\n// request 在这里已失效\n\nlet status = 200_i32;\nlet response = status;\nprintln!("{status} {response}"); // 两者都有效' }],
    exercises: [
      mc('own-move', '提交后预测：程序会怎样？', ['打印 Lewis', '编译错误：name 的所有权已移动到 user', '运行时 panic', 'double free'], 1, ['ownership'], 'String 不实现 Copy。赋值把 String 的所有权从 name 移交给 user，之后再借用 name 会被拒绝。', '非 Copy 值按值赋值会 move；move 后不能再使用原绑定。', 'fn main() {\n    let name = String::from("Lewis");\n    let user = name;\n    println!("{name}");\n}', '“两个变量像 Java 引用一样指向同一对象”很容易让人忽略 Rust 的 move 语义。', 'Java 的引用赋值复制引用；Go 的 string 赋值复制字符串值。Rust String 赋值移动所有权。'),
      mc('own-copy', 'i32 实现 Copy。下面最后一行的结果是什么？', ['编译错误：status 已移动', '输出 204 204', '输出 204 后 panic', '取决于 GC'], 1, ['ownership', 'copy-clone'], 'i32 是 Copy 类型，赋值会复制值，status 与 code 都能继续使用。', '实现 Copy 的类型按值复制；Copy 是隐式、轻量复制语义。', 'let status = 204_i32;\nlet code = status;\nprintln!("{status} {code}");', '把所有赋值都当成 move；Copy 类型是重要例外。'),
      mc('own-agent', 'AgentRequest 要进入一个异步任务队列，同时当前 handler 之后还要记录请求 id。更稳妥的第一步是什么？', ['无条件把整个 request move 进队列，再尝试继续访问它', '先从 request 拷贝或克隆需要保留的 request id，再转移拥有的数据', '所有字段都改成全局变量', '使用 unsafe 绕过检查'], 1, ['ownership', 'agent-runtime'], '先明确每份数据的去向：可复制的 ID 直接复制；确实要在两个任务中独立持有的 String 可显式 clone。避免不经思考地克隆大对象。', 'move 使资源所有权唯一；需要多个独立拥有者时，显式 clone 或共享所有权类型。', 'let request_id = request.id.clone();\nqueue.send(request).await?;\nlog::info!("queued {request_id}");', 'clone 被误解为“免费复制”，或希望一个拥有值同时被两个地方 move。'),
      concept('own-drop', 'Rust 的 Drop 与 Go 的 defer，哪个说法更准确？', ['Drop 总是在函数调用的下一行发生', '值离开作用域时自动清理；Drop 是析构机制，defer 是延迟执行语句', '两者完全相同', 'Drop 由 GC 最终决定时间'], 1, ['ownership', 'resource-lifecycle'], 'Drop 在值的析构时运行，通常是离开作用域时；具体控制流会影响时机。Go defer 按函数返回时执行，语义并不等同。', '资源释放绑定到值的生命周期；RAII/Drop 不等同于 defer 或 GC。')
    ],
    comparisonQuestion: { ...concept('compare-gc', 'Java 中执行 String b = a 后，a 通常还能用；Rust 中 let b = a 对 String 有什么不同？', ['Rust 把堆内容复制给 b', 'Rust 移动 String 所有权，a 随后不可用', 'Rust 会在运行时把 a 设为 null', '两者完全相同'], 1, ['ownership', 'java-go'], 'Java 复制的是引用；Rust 把 String 的拥有权移交给 b。', '不能把 Rust move 简化成 Java 引用赋值。') },
    challenge: { id: 'own-challenge', type: 'concept_question', prompt: '设计一个队列 enqueue API：调用方提交 String 后是否还需要继续使用原值？写出你会选用的参数传递方式，并解释理由。', tags: ['ownership', 'api-design'], referenceAnswer: '如果队列接管数据，使用 fn enqueue(item: String)；若只需读取，使用 &str 或 &String。调用方之后仍需拥有数据时，可显式 clone，或调整 API 让队列只借用/返回所有权。', explanation: 'API 的参数类型表达资源边界。拥有型参数适用于接管资源；借用适用于只读访问。', rule: '所有权设计应反映调用后的责任归属。' },
    summary: ['一个值在同一时刻有一个 owner。', '非 Copy 值赋值或传参通常发生 move。', 'owner 结束作用域时，Rust 运行 Drop；Copy 类型保留原绑定可用。'], prerequisites: []
  },
  {
    id: 'borrowing', order: 2, title: '借用 Borrowing', category: 'Ownership', difficulty: 'beginner', estimatedMinutes: 7,
    objective: '用引用让函数访问数据，而不转移资源所有权。',
    explanation: '借用让函数临时访问由调用方拥有的数据。&T 是共享引用，通常用于只读访问；&str 可以引用 String 的字符串内容，也可以直接指向字符串字面量。引用不是“裸指针的别名”：安全引用受编译器的有效性和别名规则约束。只读函数通常接受 &str，让 String 和字面量都能传入。',
    mentalModel: { description: '所有者持续持有数据；借用者获得受规则约束的访问权限。', before: 'owner ──owns──▶ String\n   ├── &str (read)\n   └── &str (read)' },
    examples: [{ language: 'rust', code: 'fn print_name(name: &str) {\n    println!("{name}");\n}\n\nlet owned = String::from("Ada");\nprint_name(&owned);\nprint_name("Lin"); // 字面量也是 &str' }],
    exercises: [
      mc('borrow-string', '调用 print_name(&name) 后，name 还能用吗？', ['不能，&name 会 move String', '可以，函数只借用它', '仅在 name 是字面量时能用', '会在运行时复制 String'], 1, ['borrowing'], '传入 &name 创建共享借用，函数不会获得 String 的所有权，所以调用后 name 仍然有效。', '借用通过 &T 访问数据，不转移 owner。', 'let name = String::from("Ada");\nprint_name(&name);\nprintln!("{name}");', '把“传参”一概当成 move，忽略参数类型是引用。'),
      concept('borrow-str', '只需读取名字，哪个签名更适合通用调用 String 与字面量？', ['fn print_name(name: String)', 'fn print_name(name: &String)', 'fn print_name(name: &str)', 'fn print_name(name: *const String)'], 2, ['borrowing', 'string-slice'], '接受 &str 让函数可使用 String 的切片，也可使用字符串字面量；签名表达了只读借用意图。', '&str 是字符串切片视图，避免不必要的所有权转移。'),
      { id: 'borrow-open', type: 'concept_question', prompt: '为什么 Rust 引用不只是一个指针？请联系“悬垂引用”与别名规则说明。', tags: ['borrowing', 'memory-safety'], referenceAnswer: '引用还受编译器检查：不能悬垂，且共享/可变借用遵守别名规则。它的有效性和访问权限在安全代码中由类型与借用检查保证。', explanation: '引用是安全访问能力，不只是一个地址。', rule: '安全引用必须指向有效数据并满足借用规则。' }
    ],
    comparisonQuestion: { ...concept('borrow-compare', 'Rust 的 &String 和 Go 的 *string 最大的语义差异是什么？', ['Rust 引用必须总是拥有数据', 'Rust 引用有编译期生命周期与别名约束', 'Go 指针不能读取数据', '没有差异'], 1, ['borrowing', 'java-go'], 'Go 指针允许通过 GC 管理目标生命周期；Rust 引用通过生命周期/借用检查约束其有效期和访问方式。', '引用并非只是在 Rust 中写法不同的裸指针。') },
    challenge: { id: 'borrow-challenge', type: 'code_completion', prompt: '补齐参数类型，让调用方保留 String 的所有权：fn print_name(name: ___) { println!("{name}"); }', tags: ['borrowing', 'string-slice'], referenceAnswer: '&str', explanation: '&str 是只读字符串切片，可由 String 借出。', rule: '按最小需求借用数据。' },
    summary: ['&T 表示共享借用，通常用于只读访问。', '&str 适合只读字符串 API。', '引用受编译期有效性和别名规则约束。'], prerequisites: ['ownership']
  },
  {
    id: 'mutable-borrowing', order: 3, title: '可变借用', category: 'Ownership', difficulty: 'beginner', estimatedMinutes: 8,
    objective: '理解 &mut T 的排他访问规则，以及它如何让状态更新安全。',
    explanation: 'Rust 允许多个共享引用同时存在，或者在某一时刻只有一个可变引用。这个规则不是说一个程序永远只能有一个 reader，而是同一段可能重叠的借用范围内，写入必须排他。它让编译器能排除许多数据竞争与迭代时修改容器等问题。',
    mentalModel: { description: '借用重叠期间：多个 reader，或一个 writer。', before: 'owner\n├── &T\n├── &T\n└── &T', after: 'owner\n└── &mut T  (exclusive)' },
    examples: [{ language: 'rust', code: 'fn mark_ready(state: &mut SessionState) {\n    state.ready = true;\n}\n\nlet mut state = SessionState::new();\nmark_ready(&mut state);' }],
    exercises: [mc('mut-rule', '下面代码在同一区间同时使用 reader 与 writer，会怎样？', ['正常编译', '编译错误：可变借用与仍在使用的共享借用重叠', '只会发生 runtime panic', '编译器自动加锁'], 1, ['mutable-borrowing'], 'reader 在 println! 中仍被使用，所以共享借用与可变借用的有效范围发生重叠，编译器拒绝。', '要么多个共享借用，要么一个可变借用；不能在重叠期间同时存在。', 'let mut count = 1;\nlet reader = &count;\nlet writer = &mut count;\nprintln!("{reader} {writer}");', '只看引用创建的位置而不看其最后使用位置，误以为不重叠。'), concept('mut-backend', '请求 handler 要原地更新一个本地可变 session，正确借用方向是什么？', ['&Session', '&mut Session', 'Arc<Session> 一定可变', 'static Session'], 1, ['mutable-borrowing', 'agent-runtime'], '在单线程局部上下文里，&mut 表达排他修改权限。跨任务共享状态还需要考虑同步原语，不能仅把它换成 Arc。', '可变借用表达排他访问，并非线程同步机制。'), { id: 'mut-open', type: 'concept_question', prompt: 'Rust 的借用规则怎样帮助发现后端共享状态中的数据竞争？它不能替代什么？', tags: ['mutable-borrowing', 'concurrency'], referenceAnswer: '编译器禁止共享访问与可变访问在借用重叠期冲突，局部安全代码因此排除许多数据竞争；但跨线程共享仍需 Send/Sync 与 Mutex/RwLock 等同步机制。', explanation: '别名约束提供基础，线程安全类型和同步原语处理并发共享。', rule: '&mut 的排他性不是互斥锁，也不是跨任务调度方案。' }],
    comparisonQuestion: { ...concept('mut-compare', 'Java 中两个对象引用能同时修改同一个对象；Rust 安全引用多了一条什么约束？', ['同一数据同时只允许一个可变借用，且不能与重叠共享借用并存', '引用不能用于读取', '只能有一个对象字段', 'Rust 一律运行时加锁'], 0, ['mutable-borrowing', 'java-go'], 'Rust 把别名与修改冲突前移到编译期检查；真正跨线程同步仍要靠同步原语。', 'Borrow checker 不等于 runtime lock。') },
    summary: ['共享借用可以并存。', '可变借用在重叠期间必须排他。', '这降低数据竞争风险，但不是 Mutex 的替代品。'], prerequisites: ['borrowing']
  },
  {
    id: 'lifetimes', order: 4, title: '生命周期', category: 'Type System', difficulty: 'intermediate', estimatedMinutes: 10,
    objective: '读懂生命周期标注描述引用关系，而不是延长数据寿命。',
    explanation: '生命周期标注说明多个引用之间的有效期关系，帮助编译器检查返回引用是否可能悬垂。它不会创建数据、延长作用域，也不是 GC。函数返回的借用值必须来自仍然有效的输入或其他有效来源。许多函数可省略显式标注，只有关系不够清楚时才写出来。',
    mentalModel: { description: '返回值必须与某个输入引用一样久；标注让关系显式。', before: 'a: ────────────────\nb: ───────\nreturn: ─────── (来自 a 或 b)' },
    examples: [{ language: 'rust', code: "fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {\n    if a.len() >= b.len() { a } else { b }\n}" }],
    exercises: [mc('life-longest', 'longest 的 <\'a> 表示什么？', ['把输入字符串都复制到静态内存', '返回引用的有效期与输入引用的关系由同一个生命周期参数约束', '手动延长变量作用域', '每次调用都分配一个生命周期对象'], 1, ['lifetime'], '函数签名描述返回借用与输入借用共享一个生命周期参数。实际传入引用的重叠有效期决定返回引用可用多久。', '生命周期参数描述引用关系，不会延长任何值的寿命。', "fn longest<'a>(a: &'a str, b: &'a str) -> &'a str", '把生命周期当作运行时对象或“延命”语法。'), concept('life-invalid', '以下哪种做法会被编译器拒绝？', ['返回输入参数的切片', '返回局部 String 的引用', '返回静态字符串字面量', '在函数内比较 &str 长度'], 1, ['lifetime'], '局部 String 离开函数时会被销毁，不能把指向它的引用返回给调用方。', '引用不能活得比其指向的数据更久。')],
    comparisonQuestion: { ...concept('life-compare', 'Java GC 与 Rust 生命周期检查的本质差别是什么？', ['Rust 生命周期标注会在运行时续命对象', 'GC 根据可达性回收；Rust 编译期验证引用关系，通常无运行时生命周期追踪', '它们是同一个机制', 'Rust 没有内存管理'], 1, ['lifetime', 'java-go'], 'GC 可达性是运行时内存管理策略；Rust 生命周期是静态检查约束，不会在运行时延长对象。', '生命周期关系不能等同于 GC 可达性。') },
    challenge: { id: 'life-challenge', type: 'concept_question', prompt: '下面为什么不合法？用一句话说明局部数据与返回引用的关系。\nfn bad() -> &str { let s = String::from("hi"); &s }', tags: ['lifetime'], referenceAnswer: 's 在 bad 返回时离开作用域并被 drop，因此返回的 &str 会悬垂，不能比其指向的 String 活得更久。', explanation: '函数签名不能令局部值逃逸其作用域。', rule: '借用必须不超过被借用数据的有效期。' },
    summary: ['生命周期标注描述引用间关系。', '标注不会延长任何值的生命周期。', '返回借用必须来自仍然有效的数据。'], prerequisites: ['borrowing', 'mutable-borrowing']
  },
  {
    id: 'struct-ownership', order: 5, title: 'Struct 与所有权', category: 'Type System', difficulty: 'intermediate', estimatedMinutes: 8,
    objective: '选择 owned field 或 borrowed field，为领域模型划清数据边界。',
    explanation: 'Struct 字段可以拥有 String 等数据，也可以保存借用引用。拥有型字段让结构体能够独立管理数据，是 API DTO、AgentSession 等长期存在领域对象的常用选择。借用字段通过生命周期参数与外部数据绑定，适合短期视图或解析结果。',
    mentalModel: { description: '领域对象拥有字段，生命周期直观；借用结构体显式绑定外部数据寿命。', before: 'AgentSession owns\n├── id: String\n└── prompt: String', after: "PromptView<'a> borrows\n└── prompt: &'a str" },
    examples: [{ language: 'rust', code: 'struct AgentSession {\n    id: String,\n    prompt: String,\n}\n\nstruct PromptView<\'a> {\n    prompt: &\'a str,\n}' }],
    exercises: [concept('struct-field', '一个会被存入 session manager 并跨多个请求保留的 AgentSession，通常先选哪种字段设计？', ['所有字段都借用 handler 栈上的引用', '直接拥有 id 与 prompt 字符串', '用裸指针避免所有权', '全改成 static'], 1, ['ownership', 'agent-runtime'], '长期存储且需独立于调用方存在的领域对象，拥有型字段最直接，不需要把其寿命绑定到创建处的局部变量。', 'owned field 让对象独立管理字段数据；borrowed field 会引入显式寿命关系。'), mc('struct-move', '把 AgentSession 放进 HashMap 后，原变量通常还能直接使用吗？', ['能，HashMap 只复制指针', '不能，insert 通常取得 session 的所有权', '只要 id 是 String 就能用', '取决于 GC'], 1, ['ownership', 'agent-runtime'], 'HashMap::insert 接收拥有值；session 被 move 进 map 后，原绑定失效。', '容器通常取得插入值的所有权。', 'let session = AgentSession { id: "s1".into(), prompt: "...".into() };\nsessions.insert(session.id.clone(), session);\n// session 已 move')],
    comparisonQuestion: { ...concept('struct-compare', 'DTO 需要从 HTTP 请求缓冲区借用字段还是独立存入数据库队列，何时偏向 owned String？', ['对象需要脱离请求缓冲区长期存活时', '永远不能用 String', '只要是 DTO 都必须借用', '只有 GC 语言能存字符串'], 0, ['ownership', 'database'], '数据会进入异步队列、数据库操作或 session 管理器时，owned 字段通常让寿命关系更简单。', '选择 owned/borrowed 应由数据跨越的边界决定。') },
    summary: ['owned field 让 struct 独立拥有数据。', 'borrowed field 通过生命周期与外部数据关联。', '长期存在的后端领域对象通常先考虑 owned data。'], prerequisites: ['ownership', 'lifetimes']
  },
  {
    id: 'traits', order: 6, title: 'Trait', category: 'Type System', difficulty: 'intermediate', estimatedMinutes: 9,
    objective: '用 trait 定义可替换能力，并理解泛型调用的静态分发。',
    explanation: 'Trait 描述一组类型需要提供的行为，接近 Java interface 或 Go interface 的抽象目标，但 Rust 是否能实现某 trait 由 trait impl 明确给出。泛型约束 T: Tool 让编译器在编译期知道具体类型，通常使用静态分发并可内联优化。',
    mentalModel: { description: '调用方依赖能力契约；具体类型提供实现。', before: 'AgentRuntime<T: Tool>\n        │\n        ▼\n   SearchTool / DbTool' },
    examples: [{ language: 'rust', code: 'trait Tool {\n    fn name(&self) -> &str;\n    fn execute(&self) -> Result<String, ToolError>;\n}\n\nfn run<T: Tool>(tool: &T) {\n    println!("{}", tool.name());\n}' }],
    exercises: [concept('trait-static', 'fn run<T: Tool>(tool: &T) 的调用通常采用哪种分发？', ['运行时反射', '静态分发：编译器针对具体 T 生成代码', '一定创建 vtable', '只能调用一个实现'], 1, ['traits', 'generics'], '泛型类型参数在编译时具体化，编译器针对使用到的类型生成特化版本，通常不需要运行时 vtable。', '泛型 trait bound 通常走静态分发。'), concept('trait-api', '要让 mock tool 与生产 tool 都实现可测试的执行能力，应抽象什么？', ['只按 struct 名称判断类型', '定义 Tool trait 并为每个类型实现它', '使用全局变量', '为每个实现创建单独 if 分支'], 1, ['traits', 'agent-runtime'], 'trait 把能力边界集中在契约中，调用端可依赖抽象，而不需要了解实现的内部结构。', 'trait 表达行为契约，impl 表达具体实现。')],
    comparisonQuestion: { ...concept('trait-compare', 'Go interface 与 Rust trait 的一个有用区别是？', ['Rust trait 实现需显式 impl；Go 通常隐式满足接口', 'Go interface 不能动态分发', 'Rust trait 只能用于数据字段', '两者都只能用继承实现'], 0, ['traits', 'java-go'], 'Go 采用结构化隐式满足；Rust 为类型显式写 impl Trait for Type。', '类比要区分实现声明方式与分发策略。') },
    challenge: { id: 'trait-challenge', type: 'code_completion', prompt: '填入 trait 关键字：___ Tool { fn name(&self) -> &str; }', tags: ['traits'], referenceAnswer: 'trait', explanation: 'trait 声明可由多个类型实现的行为契约。', rule: 'impl Tool for ConcreteType 显式提供实现。' },
    summary: ['trait 描述行为能力。', 'Rust 通过 impl 显式实现 trait。', 'T: Trait 泛型通常使用静态分发。'], prerequisites: ['ownership', 'borrowing']
  },
  {
    id: 'generics-dyn', order: 7, title: '泛型与 dyn Trait', category: 'Type System', difficulty: 'intermediate', estimatedMinutes: 10,
    objective: '根据调用场景选择静态分发或运行时动态分发。',
    explanation: 'fn execute<T: Tool>(tool: T) 让编译器按具体类型单态化生成代码，调用直接且优化空间大。&dyn Tool 则通过 trait object 和 vtable 在运行时定位实现，适合运行期才组装的异构注册表；代价是间接调用，且 trait object 有对象安全约束。',
    mentalModel: { description: '泛型在编译期选定实现；dyn Trait 在运行时通过 vtable 选定实现。', before: 'T: Tool\nCall ──direct──▶ concrete code', after: '&dyn Tool\nCall ──▶ vtable ──▶ concrete method' },
    examples: [{ language: 'rust', code: 'fn execute<T: Tool>(tool: &T) { tool.execute(); } // static\n\nstruct ToolRegistry {\n    tools: HashMap<String, Box<dyn Tool + Send + Sync>>,\n} // runtime heterogeneous set' }],
    exercises: [concept('dyn-middleware', '编译期确定的一组 middleware，优先考虑？', ['泛型 / 静态分发', '必须用 Box<dyn Trait>', 'unsafe trait object', 'Any + downcast'], 0, ['traits', 'generics'], '静态组合适合编译期已知类型，可保留静态分发和优化机会。', '使用具体类型已知的泛型约束。'), concept('dyn-registry', 'Runtime 动态 Tool Registry，需要容纳不同具体类型的 Tool。通常选择？', ['单个泛型 T 容器', 'Box<dyn Tool> 等 trait object', 'Copy trait', '生命周期标注替代类型擦除'], 1, ['traits', 'dynamic-dispatch', 'agent-runtime'], '异构容器需要统一的擦除后类型接口，trait object 可在运行时通过 vtable 调用各自实现。', 'dyn Trait 支持运行时异构抽象，调用经由 vtable。')],
    comparisonQuestion: { ...concept('dyn-compare', 'Java interface 对象引用和 Rust &dyn Trait 的共同点是？', ['都可通过运行时对象接口调用不同实现', '都保证零成本静态分发', '都自动拥有对象内存', '都允许任意不满足接口的对象'], 0, ['traits', 'dynamic-dispatch', 'java-go'], '两者可以承担运行时多态的接口调用，但内存布局、对象模型和具体限制并不完全相同。', 'Rust dyn Trait 是 trait object，有数据指针与 vtable 语义。') },
    challenge: { id: 'dyn-challenge', type: 'architecture_question', prompt: 'Agent ToolRegistry 在运行时从配置加载 search、database、file tools。简述为何这里可能选择 Box<dyn Tool>。', tags: ['dynamic-dispatch', 'agent-runtime'], referenceAnswer: '配置在运行时决定注册哪些不同类型的工具，注册表需要存储异构实现。Box<dyn Tool> 提供统一的拥有型 trait object，通过 vtable 分发调用。', explanation: '容器的异构需求决定类型擦除边界。', rule: '在需要运行时异构集合处使用 dyn Trait。' },
    summary: ['T: Trait 通常静态分发与单态化。', '&dyn Trait 使用 vtable 做动态分发。', '编译期已知的组合用泛型；运行时异构注册表可用 trait object。'], prerequisites: ['traits']
  },
  {
    id: 'result', order: 8, title: 'Result 与错误处理', category: 'Backend', difficulty: 'intermediate', estimatedMinutes: 10,
    objective: '用 Result 表达可恢复错误，并用 ? 清晰传播失败。',
    explanation: 'Result<T, E> 显式表达成功值 T 或错误 E。match 可以分别处理两条路径；? 在 Err 时提前从当前函数返回错误，在 Ok 时取出成功值。自定义错误类型让 HTTP handler、数据库和工具执行边界可以保留语义，再由 API 层映射成状态码或响应体。',
    mentalModel: { description: '错误是类型上的分支，由调用者选择处理、映射或传播。', before: 'Result<T, E>\n├── Ok(value)\n└── Err(error) ──?──▶ caller' },
    examples: [{ language: 'rust', code: 'async fn load_session(id: &str) -> Result<Session, ApiError> {\n    let row = sqlx::query!("SELECT id FROM sessions WHERE id = ?", id)\n        .fetch_one(&pool).await?;\n    Session::try_from(row)\n}' }],
    exercises: [concept('result-question', '? 在 Result 返回函数中遇到 Err(e) 时做什么？', ['忽略错误并继续', '提前从当前函数返回 Err(e)，并做兼容转换', 'panic', '自动重试'], 1, ['error-handling', 'result'], '? 把成功值交给下一步；错误路径通过 From 转换（若适用）后提前返回。它不是忽略错误，也不是自动重试。', '? 是传播运算符；错误转换需要类型关系支持。'), { id: 'result-fix', type: 'code_fix', prompt: '修复函数，让查询失败可以传播给调用者。', code: 'async fn load() -> Session {\n  let row = query().await;\n  Session::from(row)\n}', tags: ['error-handling', 'result', 'database'], referenceAnswer: 'async fn load() -> Result<Session, DbError> {\n  let row = query().await?;\n  Ok(Session::from(row))\n}', explanation: 'query 返回 Result；函数需要表达错误类型，并传播或显式匹配错误。', rule: '使用 Result 显式建模可恢复失败，不丢弃错误分支。', temptingWrong: '使用 unwrap() 可以让签名通过，但会把可恢复数据库错误变成 panic。' }, mc('result-handler', 'Axum handler 捕获 SQLx 错误后，合理做法是什么？', ['所有错误都 unwrap', '通过 ? 传播到应用错误类型，再映射为合适 HTTP 响应', '忽略错误并返回空对象', '把错误发送给客户端的任何内部细节'], 1, ['error-handling', 'database', 'web'], 'handler 通过应用错误类型统一边界，并避免向客户端泄露内部 SQL 细节。', '错误边界负责分类、传播和安全呈现。')],
    comparisonQuestion: { ...concept('result-compare', 'Go 的 (value, err) 与 Rust Result<T,E> 的共同点？', ['都显式让调用者面对失败分支', '都由 GC 自动处理', 'Rust 的 ? 会吞掉错误', 'Go error 不能返回'], 0, ['error-handling', 'java-go'], '两者都把错误作为常见返回路径显式交给调用者；Java 常见异常机制则由另一套语言规则表达。', '显式错误路径使调用方能决定传播或处理。') },
    challenge: { id: 'result-challenge', type: 'concept_question', prompt: '为 ToolExecution 设计两个错误类别：一个适合映射为 HTTP 4xx，一个适合映射为 5xx。', tags: ['error-handling', 'agent-runtime'], referenceAnswer: '例如 InvalidArguments/ApprovalDenied 可归为客户端或业务错误并映射 4xx；ToolUnavailable/DatabaseFailure 可归为服务端错误并映射 5xx。实际映射应基于 API 契约，避免泄露内部细节。', explanation: '领域错误可在边界转成 HTTP 状态，错误类型保存上下文。', rule: '错误分类应对调用者有意义，内部细节留在日志。' },
    summary: ['Result<T, E> 显式表示成功或失败。', '? 传播错误，不会自动吞错或重试。', '自定义错误类型适合跨 HTTP、DB、Tool 边界映射。'], prerequisites: ['traits', 'generics-dyn']
  },
]

lessons.push(...advancedLessons)

export const categories = ['Ownership', 'Type System', 'Concurrency', 'Web', 'Database', 'Agent Infra', 'Backend']
