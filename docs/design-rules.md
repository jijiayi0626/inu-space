# 设计规范

本文件把产品规则落成可执行的视觉与动效标准。实现时优先引用 `src/assets/base.css` 中的变量。

## 1. 颜色

设计令牌由 Fuxsto Design Pro 提供，业务样式只引用 `--fx-*` 或 `src/assets/base.css` 中的语义变量。品牌色为蓝紫：亮色 `#4F46E5`，暗色 `#A5B4FC`。

| 角色 | 令牌 | 亮色 | 暗色 |
| --- | --- | --- | --- |
| 页面背景 | `--fx-background` | `#FAFAFF` | `#0A0912` |
| 面板 / 卡片 | `--fx-surface` | `#FFFFFF` | `#131120` |
| 主文字 | `--fx-foreground` | `#14121F` | `#F5F4FB` |
| 次文字 | `--text-sub` | 主文字与底色 `68%` 混合 | 同左 |
| 弱文字 | `--fx-muted-foreground` | `#6F6B82` | `#AAA5BF` |
| 下沉区域 | `--fx-muted` | `#F3F2FA` | `#201D32` |
| 分割线 | `--fx-border` | `#E7E5F2` | `#2C2844` |
| 主操作 | `--fx-primary` | `#4F46E5` | `#A5B4FC` |
| 主操作文字 | `--fx-primary-foreground` | `#FFFFFF` | `#1E1B4B` |
| 浅色强调面 | `--fx-secondary` | `#EEF2FF` | `#2A2547` |
| 链接 / 焦点环 | `--fx-ring` | `#6366F1` | `#A5B4FC` |
| 危险 | `--fx-destructive` | `#EF4444` | 由 Fuxsto 暗色令牌提供 |
| 成功 | `--fx-success` | `#10B981` | 由 Fuxsto 暗色令牌提供 |
| 警告 | `--fx-warning` | `#F59E0B` | 由 Fuxsto 暗色令牌提供 |

暗色主题由 `[data-theme="dark"]` 切换。`base.css` 必须在该选择器内把 `--fx-*` 重新映射到 `--fx-dark-*`，否则库的暗色令牌会被应用层的亮色值覆盖。深色强调面板（余额 / 会员卡）使用 `--panel-strong` 系列变量。

规则：
- 大面积背景不用品牌色、不用渐变。
- 主按钮一个区域只出现一个。
- 状态色只用于状态，不用于装饰。
- 暗色模式不是反色，是独立的一套中性层级。

## 2. 间距与圆角

```
--s-1: 4px    --s-2: 8px    --s-3: 12px   --s-4: 16px
--s-5: 20px   --s-6: 24px   --s-7: 28px   --s-8: 32px
--s-10: 40px  --s-12: 48px

--r-xs: 4px   /* 内层 */
--r-sm: 8px   /* 控件 */
--r-md: 8px   /* 卡片 */
--r-lg: 12px
--r-xl: 16px
--r-full: 9999px
```

- 组内间距：8/12。
- 组间间距：24/32。
- 页面区块间距：32/40。
- 卡片内边距：20/24。
- 同心圆角：`outer = inner + padding`。

## 3. 阴影

用 Fuxsto 的三级柔和阴影代替边框：

```
--shadow-card:  0 1px 2px #09090B0F;
--shadow-pop:   0 12px 40px #09090B24;
--shadow-float: 0 20px 50px #09090B33;
```

暗色模式沿用相同层级，必要时用 1px 半透明描边保持轮廓。

## 4. 排版

- 页面标题 22px / 700；区块标题 15px / 600；正文 14px；辅助 12.5px。
- 标题 `text-wrap: balance`，正文 `text-wrap: pretty`。
- 数字：`font-variant-numeric: tabular-nums`。
- 行高：标题 1.3，正文 1.6，辅助 1.5。
- 中英混排不加空格装饰，不滥用全大写英文。

## 5. 布局

- 页面不套外层大卡片；内容直接铺在背景上。
- 分组 = 区块标题 + 内容 + 组间留白。
- 设置项：名称左、控件右，一项一行。
- 表单：标签在上，输入在下，顺序填写不放两列。
- 破坏性操作独立成组，和正常设置保持 24px 以上距离。
- 同类元素左边缘对齐；图标列固定宽度，文字列同起点。

## 6. 图标

- 只用 `lucide-vue-next` 线性图标，统一通过 `AppIcon.vue` 渲染。
- 默认 18px；小按钮 16px；大空状态 40px。
- 图标颜色跟随文字，不单独上彩色。
- 图标与文字间距 8–10px。

## 7. 动效

```css
/* 入场 */
.enter { opacity: 0; transform: translateY(6px); }
.enter-active { transition: opacity 180ms ease-out, transform 180ms cubic-bezier(.16,1,.3,1); }

/* 退场：只移出一小段，淡出 + 轻微模糊 */
.leave { opacity: 1; transform: none; filter: blur(0); }
.leave-active { transition: opacity 140ms ease-in, transform 140ms ease-in, filter 140ms ease-in; }
.leave-to { opacity: 0; transform: translateY(4px); filter: blur(2px); }

/* 图标交叉淡化 */
.icon-swap-enter-active, .icon-swap-leave-active { transition: opacity 140ms ease, transform 140ms ease, filter 140ms ease; }
.icon-swap-enter-from { opacity: 0; transform: scale(.9); filter: blur(1px); }
.icon-swap-leave-to { opacity: 0; transform: scale(1.06); filter: blur(1px); }
```

原则：
- 能打断：只用 transition，不用会重置的 keyframes。
- 轻退场：移出 4–8px + 淡出 + 模糊 ≤ 2px。
- 柔和切换：颜色/背景 140–180ms。
- 入场缓出：`cubic-bezier(.16,1,.3,1)`。
- 列表错开 30–50ms，总时长 ≤ 400ms。
- 禁止旋转、脉冲、扫光等循环装饰动画。

## 8. 侧边栏

- 宽度 240px；独立面板，12px 外边距，圆角 16px。
- 分组标题 11px / 600 / 弱文字；组间 24px。
- 菜单行高 40px，圆角 8px，图标 18px，图文间距 10px。
- 当前项：`--fx-secondary` 底 + `--fx-secondary-foreground` 字，不加渐变、发光或右侧装饰。
- 悬停：`--hover-soft` 底。
- 底部认证提示使用普通浅色面板，不使用渐变。

## 9. 组件与实现

- 交互组件全部来自 Fuxsto Design Pro：`Button` / `Input` / `Textarea` / `Select` / `Switch` / `Checkbox` / `Dialog` / `Message`；项目只负责布局、品牌令牌与少量排版覆盖。
- 导入顺序固定：`layers.css` → `fuxsto-design-pro/styles.css` → `base.css`。层顺序为 `reset, theme, components, app`：应用层覆盖组件，重置层不压过组件。
- 按钮：执行动作使用 `Button` 的 `primary` / `secondary` / `outline` / `ghost` / `destructive`；路由跳转保留 `RouterLink` + `.btn` 视觉类。
- 表单：标签在上，控件使用 `Input` / `Textarea` / `Select`。控件不透传 `id`，统一用 `aria-label` 提供可访问名称；`Select` 包在 `FxField` 中并用 `v-select-label` 补上触发器名称；数字输入显式转换为 `Number`。
- 开关与勾选：设置项使用 `Switch`，同意条款与多选项使用 `Checkbox`，不再使用原生 checkbox。
- 弹窗：页面通过 `BaseModal` 使用 `Dialog`，`width` 自动映射 `md` / `lg` / `xl`；`Dialog` 不接受 `class`，不要依赖外部样式选择器。
- 轻提示：统一调用 `src/lib/toast.js` 的 `toast()`，由 `Message` 渲染，顶部居中、自动消失。

## 10. 验收清单

- [ ] 没有渐变、发光、星星、轨道、装饰插画。
- [ ] 没有硬编码间距/圆角/颜色。
- [ ] 同类元素左边缘对齐。
- [ ] 设置项左名右控件，一行为一项。
- [ ] 表单标签在上，顺序填写上下排。
- [ ] 破坏性操作独立分组。
- [ ] 数字等宽；标题换行平衡。
- [ ] 动效可打断、退场轻、入场缓出。
- [ ] 亮暗主题都检查。
- [ ] 移动端可读可点。
